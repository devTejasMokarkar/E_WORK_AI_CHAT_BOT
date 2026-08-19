#!/usr/bin/env node

/**
 * Test all 7 supported questions
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

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function withRetry(fn, retries = MAX_RETRIES, delays = RETRY_DELAYS) {
  try { return await fn(); }
  catch (error) { if (retries <= 0) throw error; const delay = delays[0] || 1000; await new Promise(r => setTimeout(r, delay)); return withRetry(fn, retries - 1, delays.slice(1)); }
}

async function testQuery(query) {
  const response = await cohere.embed({ texts: [query], model: 'embed-english-v3.0', inputType: 'search_query' });
  const embeddingStr = '[' + response.embeddings[0].join(',') + ']';
  const hasShortTerm = /\b(UC|FTO|MB|AS|TS|FS|CC)\b/i.test(query);
  const threshold = hasShortTerm ? 0.2 : 0.3;
  const { data: results } = await supabase.rpc('match_documents', { query_embedding: embeddingStr, match_threshold: threshold, match_count: 5 });
  if (!results || results.length === 0) { console.log('❌ No results'); return false; }
  const context = results.map((r, i) => '[Source ' + (i+1) + ': ' + (r.source || r.category) + ']\n' + r.content).join('\n\n---\n\n');
  const systemPrompt = 'You are an AI assistant that answers questions based on the provided context from the eWork Enterprise Knowledge Base.\n\nGuidelines:\n- Answer ONLY based on the provided context\n- If the context doesn\'t contain the answer, say "I don\'t have enough information in the knowledge base to answer this question."\n- Be concise and helpful';
  const userPrompt = 'Context from knowledge base:\n' + context + '\n\nQuestion: ' + query + '\n\nAnswer:';
  const result = await withRetry(async () => { const res = await cohere.chat({ model: 'command-r7b-12-2024', message: userPrompt, preamble: systemPrompt, temperature: 0.3, maxTokens: 500 }); return res.text; });
  
  // Check if answer is meaningful (not the fallback message)
  const isFallback = result.includes("I don't have enough information");
  
  console.log('Q:', query);
  console.log('Top source:', results[0].source, '(sim:', (parseFloat(results[0].similarity)*100).toFixed(1) + '%)');
  console.log('Fallback:', isFallback ? 'YES ⚠️' : 'NO ✅');
  console.log('Answer preview:', result.substring(0, 200).replace(/\n/g, ' ') + '...');
  console.log('');
  
  return !isFallback;
}

async function main() {
  const queries = [
    'Voucher forward नहीं हो रहा है',
    'How can I generate an FTO',
    'Estimate approve कैसे करें',
    'UC generate नहीं हो रही है',
    'Final MB कैसे बनाएं',
    'Vendor list में दिखाई नहीं दे रहा',
    'Work proposal submit नहीं हो रहा'
  ];
  
  console.log('Testing all 7 supported questions...\n');
  
  let passed = 0;
  for (const q of queries) {
    const ok = await testQuery(q);
    if (ok) passed++;
  }
  
  console.log('========================================');
  console.log('Results:', passed + '/' + queries.length + ' passed');
  if (passed === queries.length) {
    console.log('✅ All tests PASSED!');
  } else {
    console.log('❌ Some tests FAILED');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});