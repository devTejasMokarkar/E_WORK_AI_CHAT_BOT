#!/usr/bin/env node

/**
 * Ingest Q&A pairs as structured documents for exact matching
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const fs = require('fs');
const path = require('path');
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

const BATCH_SIZE = 10;

async function generateEmbedding(text, inputType = 'search_document') {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType,
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
  throw new Error('Failed to generate embedding');
}

async function storeQAPairs(qaPairs) {
  let stored = 0;
  
  for (let i = 0; i < qaPairs.length; i += BATCH_SIZE) {
    const batch = qaPairs.slice(i, i + BATCH_SIZE);
    const rows = [];
    
    for (const qa of batch) {
      // Store as combined Q&A for better retrieval
      const content = `Q: ${qa.question}\n\nA: ${qa.answer}`;
      const embedding = await generateEmbedding(content);
      const embeddingStr = `[${embedding.join(',')}]`;
      
      rows.push({
        content,
        category: qa.category,
        source: qa.source,
        embedding: embeddingStr,
      });
    }
    
    const { error } = await supabase
      .from('knowledge_base')
      .insert(rows);
    
    if (error) {
      throw error;
    }
    
    stored += rows.length;
    console.log(`  Stored batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(qaPairs.length / BATCH_SIZE)} (${stored}/${qaPairs.length})`);
  }
  
  return stored;
}

async function clearExistingData(source) {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('source', source);
  
  if (error) {
    console.warn(`Warning clearing ${source}:`, error.message);
  } else {
    console.log(`Cleared existing data for source: ${source}`);
  }
}

async function main() {
  const qaPath = path.join(__dirname, '..', 'data', 'qa_pairs.json');
  
  if (!fs.existsSync(qaPath)) {
    console.error('QA pairs file not found:', qaPath);
    process.exit(1);
  }
  
  const qaPairs = JSON.parse(fs.readFileSync(qaPath, 'utf8'));
  console.log(`Loaded ${qaPairs.length} Q&A pairs`);
  
  try {
    await clearExistingData('eWork_Troubleshooting_QA');
    
    console.log('Generating embeddings and storing...');
    const stored = await storeQAPairs(qaPairs);
    
    console.log(`\n✅ Successfully ingested ${stored} Q&A pairs`);
    console.log('📚 Knowledge base updated with troubleshooting content!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});