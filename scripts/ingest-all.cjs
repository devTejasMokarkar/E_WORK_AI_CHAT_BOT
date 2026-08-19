#!/usr/bin/env node

/**
 * Ingest all documents from uploads/ directory
 * Supports PDF and PPTX files
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { CohereClient } = require('cohere-ai');
const PDFParser = require('pdf2json');

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

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CHUNK_SIZE = 500;
const OVERLAP = 50;
const BATCH_SIZE = 10;

async function extractTextFromPDF(pdfPath) {
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

async function extractTextFromPPTX(pptxPath) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(pptxPath);
  const entries = zip.getEntries();
  let text = '';
  
  for (const entry of entries) {
    if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
      const content = entry.getData().toString('utf8');
      // Extract text from XML
      const textMatches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
      if (textMatches) {
        for (const match of textMatches) {
          const cleanText = match.replace(/<[^>]*>/g, '');
          if (cleanText.trim()) {
            text += cleanText + ' ';
          }
        }
      }
      text += '\n';
    }
  }
  return text;
}

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = OVERLAP) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
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

async function storeChunks(chunks, source, category) {
  let stored = 0;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const rows = [];
    
    for (const chunk of batch) {
      const embedding = await generateEmbedding(chunk);
      const embeddingStr = `[${embedding.join(',')}]`;
      rows.push({
        content: chunk,
        category,
        source,
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
    console.log(`  Stored batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${stored}/${chunks.length} chunks)`);
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

async function processFile(file) {
  const filePath = path.join(UPLOADS_DIR, file);
  const ext = path.extname(file).toLowerCase();
  
  console.log(`\n📄 Processing: ${file}`);
  
  let text = '';
  let category = 'eWork Enterprise Knowledge Base';
  
  if (ext === '.pdf') {
    text = await extractTextFromPDF(filePath);
    category = 'eWork Enterprise Knowledge Base';
  } else if (ext === '.pptx') {
    text = await extractTextFromPPTX(filePath);
    if (file.includes('Best_Practices')) {
      category = 'eWork Best Practices';
    } else if (file.includes('mobileApp') || file.includes('MLA')) {
      category = 'Mobile App MLA Recommendations';
    } else if (file.includes('e-work_web') || file.includes('E- WORK')) {
      category = 'eWork Web Portal';
    } else if (file.includes('ग्रामीण') || file.includes('पंचायती')) {
      category = 'Gramin Vikas Panchayati Raj';
    } else {
      category = 'eWork Presentation';
    }
  } else {
    console.log(`  Skipping unsupported file type: ${ext}`);
    return 0;
  }
  
  console.log(`  Extracted ${text.length} characters`);
  
  if (text.length < 100) {
    console.log(`  Text too short, skipping`);
    return 0;
  }
  
  await clearExistingData(file);
  
  console.log('  Chunking text...');
  const chunks = chunkText(text);
  console.log(`  Created ${chunks.length} chunks`);
  
  console.log('  Generating embeddings and storing...');
  const stored = await storeChunks(chunks, file, category);
  
  console.log(`✅ Ingested ${stored} chunks from ${file}`);
  return stored;
}

async function main() {
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => f.endsWith('.pdf') || f.endsWith('.pptx'))
    .sort();
  
  console.log(`Found ${files.length} files to process:`);
  files.forEach(f => console.log(`  - ${f}`));
  
  let totalStored = 0;
  
  for (const file of files) {
    try {
      const stored = await processFile(file);
      totalStored += stored;
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\n✅ Total chunks ingested: ${totalStored}`);
  console.log('📚 Knowledge base updated!');
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});