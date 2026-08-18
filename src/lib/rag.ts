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
export async function searchKnowledgeBase(query: string, topK: number = 3): Promise<RAGResult[]> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // For now, we'll do a simple text search since we don't have pgvector
    // In production, you would use Supabase's vector similarity search
    const { data: documents, error } = await supabase
      .from('knowledge_base')
      .select('content, category, source');
    
    if (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
    
    if (!documents || documents.length === 0) {
      return [];
    }
    
    // Simple keyword-based scoring as fallback
    const results: Array<{ doc: typeof documents[0]; score: number }> = [];
    
    for (const doc of documents) {
      // Calculate simple similarity score based on word overlap
      const queryWords = query.toLowerCase().split(/\s+/);
      const docWords = doc.content.toLowerCase().split(/\s+/);
      
      let matches = 0;
      for (const qw of queryWords) {
        if (qw.length > 3 && docWords.some(dw => dw.includes(qw))) {
          matches++;
        }
      }
      
      const score = matches / queryWords.length;
      if (score > 0) {
        results.push({ doc, score });
      }
    }
    
    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => ({
      content: r.doc.content,
      similarity: r.score,
      source: r.doc.source || r.doc.category || 'unknown',
    }));
  } catch (error) {
    console.error('Error in searchKnowledgeBase:', error);
    return [];
  }
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