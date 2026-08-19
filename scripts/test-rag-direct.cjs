#!/usr/bin/env node

/**
 * Test the TypeScript RAG module directly
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { CohereClient } = require('cohere-ai');

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!COHERE_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { transport: WebSocket },
});
const cohere = new CohereClient({ token: COHERE_API_KEY });

const TOP_K = 5;
const SIMILARITY_THRESHOLD = 0.3;

async function generateQueryEmbedding(text) {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });
  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings[0];
  }
  if (response.embeddingsByType && response.embeddingsByType.float) {
    const floatEmbeddings = response.embeddingsByType.float;
    if (Array.isArray(floatEmbeddings) && Array.isArray(floatEmbeddings[0])) {
      return floatEmbeddings[0];
    }
  }
  throw new Error('Failed to generate query embedding');
}

async function searchKnowledgeBase(query, topK = TOP_K) {
  const queryEmbedding = await generateQueryEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  const { data: results, error } = await supabase
    .rpc('match_documents', {
      query_embedding: embeddingStr,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: topK,
    });
  
  if (!error && results && results.length > 0) {
    return results.map(r => ({
      content: r.content,
      source: r.source || r.category || 'unknown',
      similarity: typeof r.similarity === 'string' ? parseFloat(r.similarity) : r.similarity,
    }));
  }
  
  // Fallback to keyword search
  const { data: documents } = await supabase
    .from('knowledge_base')
    .select('content, source, category');
  
  if (!documents || documents.length === 0) return [];
  
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  
  const scored = documents.map(row => {
    const contentWords = row.content.toLowerCase();
    let matches = 0;
    for (const qw of queryWords) {
      const wordRegex = new RegExp(`\\b${qw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (contentWords.match(wordRegex) || (qw.length <= 4 && contentWords.includes(qw))) {
        matches++;
      }
    }
    return { ...row, score: matches / queryWords.length };
  }).filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  return scored.map(r => ({
    content: r.content,
    source: r.source || r.category || 'unknown',
    similarity: r.score,
  }));
}

async function generateResponse(query, context) {
  const systemPrompt = `You are an AI assistant that answers questions based on the provided context from the eWork Enterprise Knowledge Base.

Guidelines:
- Answer ONLY based on the provided context
- If the context doesn't contain the answer, say "I don't have enough information in the knowledge base to answer this question."
- Be concise and helpful`;

  const userPrompt = `Context from knowledge base:
${context}

Question: ${query}

Answer:`;

  try {
const response = await cohere.chat({
    model: 'command-r7b-12-2024',
    message: userPrompt,
    preamble: systemPrompt,
    temperature: 0.3,
    maxTokens: 500,
  });
    return response.text;
  } catch (error) {
    console.error('Error generating response:', error.message);
    return 'Sorry, I encountered an error generating a response.';
  }
}

async function testQuery(query) {
  console.log('\n🔍 Query:', query);
  
  try {
    const results = await searchKnowledgeBase(query, TOP_K);
    
    if (results.length === 0) {
      console.log('❌ No relevant information found in the knowledge base.');
      return;
    }
    
    console.log(`✅ Found ${results.length} relevant chunks:`);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const preview = r.content.substring(0, 150).replace(/\n/g, ' ') + '...';
      console.log(`  ${i+1}. [${r.source}] (similarity: ${(r.similarity * 100).toFixed(1)}%)`);
      console.log(`     "${preview}"`);
    }
    
    const context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
    
    console.log('\n🤖 Generating response...');
    const response = await generateResponse(query, context);
    console.log('\n📝 Response:', response);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function main() {
  const testQueries = [
    'Voucher forward नहीं हो रहा है',
    'How can I generate an FTO',
    'Estimate approve कैसे करें',
    'UC generate नहीं हो रही है',
    'Final MB कैसे बनाएं',
    'Vendor list में दिखाई नहीं दे रहा',
    'Work proposal submit नहीं हो रहा',
  ];
  
  console.log('Testing RAG with all supported questions...\n');
  
  for (const query of testQueries) {
    await testQuery(query);
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n✅ All tests completed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});