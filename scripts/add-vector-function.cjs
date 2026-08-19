#!/usr/bin/env node

/**
 * Add pgvector similarity search function to Supabase
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const { Pool } = require('pg');
const { URL } = require('url');

const DIRECT_CONNECTION = process.env.NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION;

if (!DIRECT_CONNECTION) {
  console.error('Error: NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION not set');
  process.exit(1);
}

const connUrl = new URL(DIRECT_CONNECTION);
const pool = new Pool({
  host: connUrl.hostname,
  port: connUrl.port || 5432,
  database: connUrl.pathname.slice(1),
  user: connUrl.username,
  password: connUrl.password,
  family: 4,
  max: 10,
});

const FUNCTION_SQL = `
-- Create the match_documents function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  content text,
  category text,
  source text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kb.id,
    kb.content,
    kb.category,
    kb.source,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;
`;

async function main() {
  console.log('Adding match_documents function...');
  
  try {
    await pool.query(FUNCTION_SQL);
    console.log('✅ Function created successfully!');
  } catch (error) {
    console.error('❌ Error creating function:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();