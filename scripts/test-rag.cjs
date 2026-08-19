#!/usr/bin/env node

/**
 * Test RAG search and response using Supabase REST API (works over IPv4)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { CohereClient } = require('cohere-ai');
const WebSocket = require('ws');

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!COHERE_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing env vars: COHERE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    transport: WebSocket,
  },
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
  throw new Error('Failed to generate query embedding');
}

async function searchKnowledgeBase(query, topK = TOP_K) {
  const queryEmbedding = await generateQueryEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  // Try vector search via RPC - check correct parameter name
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
      similarity: r.similarity,
    }));
  }
  
  // Debug the error
  console.log('  Vector search error:', JSON.stringify(error, null, 2));
  console.log('  Falling back to keyword search...');
  const { data: documents, error: kbError } = await supabase
    .from('knowledge_base')
    .select('content, source, category');
  
  if (kbError || !documents || documents.length === 0) {
    return [];
  }
  
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const scored = documents.map(row => {
    const contentWords = row.content.toLowerCase().split(/\s+/);
    let matches = 0;
    for (const qw of queryWords) {
      if (contentWords.some(dw => dw.includes(qw))) matches++;
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

  const response = await cohere.chat({
    model: 'command-r7b-12-2024',
    message: userPrompt,
    preamble: systemPrompt,
    temperature: 0.3,
    maxTokens: 500,
  });
  
  return response.text;
}

async function testQuery(query) {
  console.log(`\n🔍 Query: "${query}"\n`);
  
  const results = await searchKnowledgeBase(query, TOP_K);
  
  if (results.length === 0) {
    console.log('❌ No relevant information found');
    return;
  }
  
  console.log(`📚 Found ${results.length} relevant chunks:`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const preview = r.content.substring(0, 150).replace(/\n/g, ' ') + '...';
    console.log(`  [${i+1}] ${r.source} (${(r.similarity * 100).toFixed(1)}%)`);
    console.log(`      "${preview}"`);
  }
  
  const context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
  
  console.log('\n🤖 Generating response...');
  const response = await generateResponse(query, context);
  console.log(`\n✅ Response:\n${response}`);
}

async function main() {
  const queries = [
    'What is eWork?',
    'How does eWork help with project management?',
    'What are the key features of eWork?',
    'How to generate FTO in eWork?',
    'What is the work flow in eWork?'
  ];
  
  for (const query of queries) {
    await testQuery(query);
    console.log('\n' + '='.repeat(80));
  }
}

main();