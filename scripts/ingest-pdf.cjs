#!/usr/bin/env node

/**
 * PDF Ingestion Script
 * Reads PDF from uploads/, chunks text, generates embeddings, stores in Supabase
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { CohereClient } = require('cohere-ai');
const { URL } = require('url');

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const DIRECT_CONNECTION = process.env.NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION;

if (!COHERE_API_KEY) {
  console.error('Error: COHERE_API_KEY not set');
  process.exit(1);
}

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

const cohere = new CohereClient({ token: COHERE_API_KEY });

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CHUNK_SIZE = 500;
const OVERLAP = 50;
const BATCH_SIZE = 10;

async function extractTextFromPDF(pdfPath) {
  const PDFParser = require('pdf2json');
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(errData.parserError));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      let text = '';
      if (pdfData.Pages) {
        for (const page of pdfData.Pages) {
          if (page.Texts) {
            for (const textItem of page.Texts) {
              if (textItem.R) {
                for (const run of textItem.R) {
                  if (run.T) {
                    // Decode URI component to get actual text
                    text += decodeURIComponent(run.T) + ' ';
                  }
                }
              }
            }
          }
          text += '\n';
        }
      }
      resolve(text);
    });
    
    pdfParser.loadPDF(pdfPath);
  });
}

async function generateEmbedding(text) {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });
  
  const embeddings = response.embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings[0];
  }
  throw new Error('Failed to generate embedding');
}

async function storeChunks(chunks, source, category) {
  const client = await pool.connect();
  let stored = 0;
  
  try {
    await client.query('BEGIN');
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      for (const chunk of batch) {
        const embedding = await generateEmbedding(chunk);
        
        const embeddingStr = `[${embedding.join(',')}]`;
        
        await client.query(
          `INSERT INTO knowledge_base (content, category, source, embedding) 
           VALUES ($1, $2, $3, $4::vector)`,
          [chunk, category, source, embeddingStr]
        );
        stored++;
      }
      
      console.log(`  Stored batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${stored}/${chunks.length} chunks)`);
    }
    
    await client.query('COMMIT');
    return stored;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkTableExists() {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'knowledge_base'
    )
  `);
  return result.rows[0].exists;
}

async function ensureVectorExtension() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
}

async function ensureEmbeddingColumn() {
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'knowledge_base' AND column_name = 'embedding'
  `);
  
  if (result.rows.length === 0) {
    console.log('Adding embedding column to knowledge_base...');
    await pool.query('ALTER TABLE knowledge_base ADD COLUMN embedding vector(1024)');
  }
}

async function clearExistingData(source) {
  await pool.query('DELETE FROM knowledge_base WHERE source = $1', [source]);
  console.log(`Cleared existing data for source: ${source}`);
}

async function main() {
  const pdfFile = 'eWork_Enterprise_General_Information_Knowledge_Base.pdf';
  const pdfPath = path.join(UPLOADS_DIR, pdfFile);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found at: ${pdfPath}`);
    console.log('Available files in uploads:');
    const files = fs.readdirSync(UPLOADS_DIR);
    files.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
  
  console.log(`\n📄 Processing PDF: ${pdfFile}`);
  console.log(`📁 From: ${pdfPath}\n`);
  
  try {
    await ensureVectorExtension();
    await ensureEmbeddingColumn();
    
    const tableExists = await checkTableExists();
    if (!tableExists) {
      console.error('knowledge_base table does not exist. Run schema.sql first.');
      process.exit(1);
    }
    
    await clearExistingData(pdfFile);
    
    console.log('📖 Extracting text from PDF...');
    const text = await extractTextFromPDF(pdfPath);
    console.log(`✅ Extracted ${text.length} characters`);
    
    console.log('\n✂️  Chunking text...');
    const chunks = chunkText(text, CHUNK_SIZE, OVERLAP);
    console.log(`✅ Created ${chunks.length} chunks (size: ${CHUNK_SIZE}, overlap: ${OVERLAP})`);
    
    console.log('\n🔮 Generating embeddings and storing in Supabase...');
    const stored = await storeChunks(chunks, pdfFile, 'eWork Enterprise Knowledge Base');
    
    console.log(`\n✅ Successfully ingested ${stored} chunks from ${pdfFile}`);
    console.log('📚 Knowledge base updated. You can now chat with the PDF content!\n');
    
  } catch (error) {
    console.error('\n❌ Error during ingestion:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();