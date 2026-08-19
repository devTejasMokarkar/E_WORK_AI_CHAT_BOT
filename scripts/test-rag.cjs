#!/usr/bin/env node

/**
 * Test RAG search and response
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const { Pool } = require('pg');
const { CohereClient } = require('cohere-ai');

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const DIRECT_CONNECTION = process.env.NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION;

if (!COHERE_API_KEY || !DIRECT_CONNECTION) {
  console.error('Missing env vars');
  process.exit(1);
}

const cohere = new CohereClient({ token: COHERE_API_KEY });
const pool = new Pool({ connectionString: DIRECT_CONNECTION });

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
  
  // Try vector search
  const result = await pool.query(
    `SELECT content, source, 1 - (embedding <=> $1::vector) as similarity
     FROM knowledge_base
     WHERE embedding IS NOT NULL
     AND 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [embeddingStr, SIMILARITY_THRESHOLD, topK]
  );
  
  if (result.rows.length > 0) {
    return result.rows;
  }
  
  // Fallback to keyword search
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const kbResult = await pool.query('SELECT content, source FROM knowledge_base');
  
  const scored = kbResult.rows.map(row => {
    const contentWords = row.content.toLowerCase().split(/\s+/);
    let matches = 0;
    for (const qw of queryWords) {
      if (contentWords.some(dw => dw.includes(qw))) matches++;
    }
    return { ...row, score: matches / queryWords.length };
  }).filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  return scored.map(r => ({ ...r, similarity: r.score }));
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
  
  await pool.end();
}

main();