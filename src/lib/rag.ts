/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles document chunking, embedding, and similarity search
 */
import { generateQueryEmbedding } from './cohere';
import { supabase } from './supabase';
import type { RAGResult } from '@/types';

/**
 * Chunk text into smaller pieces for embedding
 * Similar to the Python chunker implementation
 */
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap from the end of the previous chunk
      const words = currentChunk.split(/\s+/);
      currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence;
    } else {
      currentChunk += sentence + ' ';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Search the knowledge base using semantic similarity
 */
export async function searchKnowledgeBase(query: string, topK: number = 5): Promise<RAGResult[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // Use pgvector similarity search
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Use lower threshold for short terms (UC, FTO, MB, AS, TS, FS, CC)
    const hasShortTerm = /\b(UC|FTO|MB|AS|TS|FS|CC)\b/i.test(query);
    const threshold = hasShortTerm ? 0.2 : 0.3;
    
    const { data: documents, error } = await supabase
      .rpc('match_documents', {
        query_embedding: embeddingStr,
        match_threshold: threshold,
        match_count: topK,
      });
    
    if (error) {
      // Fallback to keyword search if RPC doesn't exist
      console.warn('Vector search not available, falling back to keyword search:', error.message);
      return fallbackKeywordSearch(query, topK);
    }
    
    if (!documents || documents.length === 0) {
      return [];
    }
    
    return documents.map((doc: { content: string; similarity: string | number; source?: string; category?: string }) => ({
      content: doc.content,
      similarity: typeof doc.similarity === 'string' ? parseFloat(doc.similarity) : doc.similarity,
      source: doc.source || doc.category || 'unknown',
    }));
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error);
    return fallbackKeywordSearch(query, topK);
  }
}

async function fallbackKeywordSearch(query: string, topK: number): Promise<RAGResult[]> {
  const { data: documents, error } = await supabase
    .from('knowledge_base')
    .select('content, category, source');
  
  if (error || !documents || documents.length === 0) {
    return [];
  }
  
  const results: Array<{ doc: typeof documents[0]; score: number }> = [];
  
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  
  for (const doc of documents) {
    const docContent = doc.content.toLowerCase();
    
    let matches = 0;
    for (const qw of queryWords) {
      // Check for exact word boundary match or substring match for short words
      const wordRegex = new RegExp(`\\b${qw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (docContent.match(wordRegex) || (qw.length <= 4 && docContent.includes(qw))) {
        matches++;
      }
    }
    
    const score = matches / queryWords.length;
    if (score > 0) {
      results.push({ doc, score });
    }
  }
  
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, topK).map(r => ({
    content: r.doc.content,
    similarity: r.score,
    source: r.doc.source || r.doc.category || 'unknown',
  }));
}

/**
 * Get context from knowledge base for chatbot
 */
export async function getContextForQuery(query: string): Promise<string> {
  const results = await searchKnowledgeBase(query, 3);
  
  if (results.length === 0) {
    return 'No relevant information found in the knowledge base.';
  }
  
  return results.map(r => r.content).join('\n\n');
}

/**
 * Add a document to the knowledge base
 */
export async function addToKnowledgeBase(
  content: string,
  category: string,
  source: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('knowledge_base')
      .insert({ content, category, source });
    
    if (error) {
      console.error('Error adding to knowledge base:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error adding to knowledge base:', error);
    return false;
  }
}

/**
 * Get all categories in the knowledge base
 */
export async function getKnowledgeBaseCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('category');
  
  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  
  const categories = new Set(data?.map(d => d.category).filter(Boolean));
  return Array.from(categories);
}

/**
 * Search by category
 */
export async function searchByCategory(category: string): Promise<RAGResult[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('content, category, source')
    .eq('category', category);
  
  if (error || !data) {
    return [];
  }
  
  return data.map(doc => ({
    content: doc.content,
    similarity: 1.0,
    source: doc.source || doc.category || 'unknown',
  }));
}