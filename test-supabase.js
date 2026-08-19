require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { CohereClient } = require('cohere-ai');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function run() {
  const query = 'How can I generate an FTO?';
  
  // 1. Embed
  const response = await cohere.embed({
    texts: [query],
    model: 'embed-english-v3.0',
    inputType: 'search_query',
  });
  const emb = response.embeddings[0];
  console.log('Embedding size:', emb.length);
  
  // 2. Search
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: `[${emb.join(',')}]`,
    match_threshold: 0.5,
    match_count: 3,
  });
  
  if (error) {
    console.error('Supabase RPC Error:', error);
  } else {
    console.log('Supabase RPC Results:', data);
  }
}
run();
