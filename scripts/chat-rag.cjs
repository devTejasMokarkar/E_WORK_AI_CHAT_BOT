#!/usr/bin/env node

/**
 * Terminal RAG Chatbot
 * Chat with the ingested PDF content using RAG
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const readline = require('readline');
const { Pool } = require('pg');
const { CohereClient } = require('cohere-ai');

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

const cohere = new CohereClient({ token: COHERE_API_KEY });
const pool = new Pool({ connectionString: DIRECT_CONNECTION });

const TOP_K = 5;
const SIMILARITY_THRESHOLD = 0.3;

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bright: '\x1b[1m',
  dim: '\x1b[2m'
};

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
  
  try {
    // Try vector search first
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
  } catch (error) {
    console.log(`${colors.yellow}Vector search failed, trying RPC...${colors.reset}`);
  }
  
  // Try RPC function
  try {
    const result = await pool.query(
      `SELECT * FROM match_documents($1::vector, $2, $3)`,
      [embeddingStr, SIMILARITY_THRESHOLD, topK]
    );
    return result.rows;
  } catch (error) {
    console.log(`${colors.yellow}RPC failed, falling back to keyword search...${colors.reset}`);
  }
  
  // Fallback to keyword search
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const result = await pool.query(
    `SELECT content, source FROM knowledge_base`
  );
  
  const scored = result.rows.map(row => {
    const contentWords = row.content.toLowerCase().split(/\s+/);
    let matches = 0;
    for (const qw of queryWords) {
      if (contentWords.some(dw => dw.includes(qw))) {
        matches++;
      }
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
- Be concise and helpful
- Cite relevant parts of the context when possible`;

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
    console.error(`${colors.red}Error generating response:${colors.reset}`, error.message);
    return 'Sorry, I encountered an error generating a response.';
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║  eWork RAG Terminal Chatbot              ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║  Chat with the eWork Knowledge Base PDF  ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  console.log(`${colors.dim}Commands:${colors.reset}`);
  console.log(`${colors.dim}  /exit, /quit - Exit the chat${colors.reset}`);
  console.log(`${colors.dim}  /help        - Show this help${colors.reset}`);
  console.log(`${colors.dim}  /clear       - Clear screen${colors.reset}`);
  console.log(`${colors.dim}  /stats       - Show knowledge base stats${colors.reset}`);
  console.log('');
  console.log(`${colors.green}Ready! Ask me anything about the eWork Enterprise Knowledge Base.${colors.reset}`);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}You: ${colors.reset}`
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();
    
    if (trimmed === '') {
      rl.prompt();
      return;
    }
    
    // Handle commands
    if (trimmed.startsWith('/')) {
      const cmd = trimmed.toLowerCase();
      
      if (cmd === '/exit' || cmd === '/quit') {
        console.log(`${colors.green}Goodbye! 👋${colors.reset}`);
        rl.close();
        await pool.end();
        process.exit(0);
      } else if (cmd === '/help') {
        console.log(`${colors.dim}Commands:${colors.reset}`);
        console.log(`${colors.dim}  /exit, /quit - Exit the chat${colors.reset}`);
        console.log(`${colors.dim}  /help        - Show this help${colors.reset}`);
        console.log(`${colors.dim}  /clear       - Clear screen${colors.reset}`);
        console.log(`${colors.dim}  /stats       - Show knowledge base stats${colors.reset}`);
      } else if (cmd === '/clear') {
        console.clear();
        console.log(`${colors.bright}${colors.cyan}eWork RAG Terminal Chatbot${colors.reset}`);
        console.log(`${colors.green}Ready! Ask me anything about the eWork Enterprise Knowledge Base.${colors.reset}`);
      } else if (cmd === '/stats') {
        try {
          const countResult = await pool.query('SELECT COUNT(*) as count FROM knowledge_base');
          const embedResult = await pool.query('SELECT COUNT(*) as count FROM knowledge_base WHERE embedding IS NOT NULL');
          console.log(`${colors.cyan}Knowledge Base Stats:${colors.reset}`);
          console.log(`  Total documents: ${countResult.rows[0].count}`);
          console.log(`  With embeddings: ${embedResult.rows[0].count}`);
        } catch (error) {
          console.log(`${colors.red}Error getting stats:${colors.reset}`, error.message);
        }
      } else {
        console.log(`${colors.red}Unknown command: ${cmd}${colors.reset}`);
      }
      
      rl.prompt();
      return;
    }
    
    // Process the query
    console.log(`${colors.yellow}Searching knowledge base...${colors.reset}`);
    
    try {
      const results = await searchKnowledgeBase(trimmed, TOP_K);
      
      if (results.length === 0) {
        console.log(`${colors.red}No relevant information found in the knowledge base.${colors.reset}`);
        rl.prompt();
        return;
      }
      
      // Show sources
      console.log(`${colors.magenta}Found ${results.length} relevant chunks:${colors.reset}`);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const preview = r.content.substring(0, 100).replace(/\n/g, ' ') + '...';
        console.log(`  ${colors.dim}[${i+1}]${colors.reset} ${colors.cyan}${r.source}${colors.reset} (similarity: ${(r.similarity * 100).toFixed(1)}%)`);
        console.log(`      ${colors.dim}"${preview}"${colors.reset}`);
      }
      console.log('');
      
      // Build context
      const context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
      
      // Generate response
      console.log(`${colors.yellow}Generating response...${colors.reset}`);
      const response = await generateResponse(trimmed, context);
      
      console.log(`${colors.green}Assistant:${colors.reset} ${response}`);
      console.log('');
      
    } catch (error) {
      console.error(`${colors.red}Error:${colors.reset}`, error.message);
    }
    
    rl.prompt();
  }).on('close', async () => {
    console.log(`\n${colors.green}Goodbye! 👋${colors.reset}\n`);
    await pool.end();
    process.exit(0);
  });
}

main();