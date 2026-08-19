#!/usr/bin/env node

/**
 * Terminal RAG Chatbot - works with or without TTY
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { CohereClient } = require('cohere-ai');
const WebSocket = require('ws');

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
  
  const { data: documents } = await supabase
    .from('knowledge_base')
    .select('content, source, category');
  
  if (!documents || documents.length === 0) return [];
  
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

async function processQuery(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const GREETING_PATTERNS = /^(hi|hello|start|namaste|नमस्ते|hey|hi there)$/i;
  
  if (GREETING_PATTERNS.test(normalizedQuery)) {
    console.log(`${colors.green}Assistant:${colors.reset} Welcome to the e-Work WhatsApp Assistant.\n\nPlease select an option:\n1. Ask e-Work Chatbot\n2. e-Work Information\n`);
    return;
  }

  if (normalizedQuery.length < 3) {
    console.log(`${colors.red}Please provide a longer question so I can search the knowledge base effectively.${colors.reset}\n`);
    return;
  }

  console.log(`${colors.yellow}Searching knowledge base...${colors.reset}`);
  
  try {
    const results = await searchKnowledgeBase(query, TOP_K);
    
    if (results.length === 0) {
      console.log(`${colors.red}No relevant information found in the knowledge base.${colors.reset}\n`);
      return;
    }
    
    console.log(`${colors.magenta}Found ${results.length} relevant chunks:${colors.reset}`);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const preview = r.content.substring(0, 100).replace(/\n/g, ' ') + '...';
      console.log(`  ${colors.dim}[${i+1}]${colors.reset} ${colors.cyan}${r.source}${colors.reset} (similarity: ${(r.similarity * 100).toFixed(1)}%)`);
      console.log(`      ${colors.dim}"${preview}"${colors.reset}`);
    }
    console.log('');
    
    const context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
    
    console.log(`${colors.yellow}Generating response...${colors.reset}`);
    const response = await generateResponse(query, context);
    
    console.log(`${colors.green}Assistant:${colors.reset} ${response}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║  eWork RAG Terminal Chatbot              ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║  Chat with the eWork Knowledge Base PDF  ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  console.log(`${colors.dim}Commands (prefix with /):${colors.reset}`);
  console.log(`${colors.dim}  /exit, /quit - Exit${colors.reset}`);
  console.log(`${colors.dim}  /help        - Show help${colors.reset}`);
  console.log(`${colors.dim}  /stats       - Knowledge base stats${colors.reset}`);
  console.log('');
  console.log(`${colors.green}Ready! Type your question and press Enter.${colors.reset}`);
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ''
  });

  let currentMenu = 'MAIN_MENU';
  let workId = null;

  function printMainMenu() {
    console.log(`${colors.green}Assistant:${colors.reset} Welcome to the e-Work WhatsApp Assistant.\n`);
    console.log(`Please select an option:\n1. Ask e-Work Chatbot\n2. e-Work Information\n`);
  }

  function printWorkMenu() {
    console.log(`Menu:
1. Work Details
2. Administrative Sanction
3. Technical Sanction
4. Financial Sanction
5. Estimate
6. Work Progress
7. Work Photos
8. Measurement Book
9. Voucher Details
10. FTO Details
11. Utilization Certificate
12. Completion Certificate
13. Main Menu\n`);
  }

  function printAskChatbotMenu() {
    console.log(`${colors.green}Assistant:${colors.reset} Registration is not required for this option.\n`);
    console.log(`Supported questions:
- Voucher forward नहीं हो रहा है।
- How can I generate an FTO?
- Estimate approve कैसे करें?
- UC generate नहीं हो रही है।
- Final MB कैसे बनाएं?
- Vendor list में दिखाई नहीं दे रहा है।
- Work proposal submit नहीं हो रहा है。\n`);
    console.log(`Ask your question (or type "back" to return to main menu):\n`);
  }

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) return;
    const normalizedInput = input.toLowerCase();
    
    if (normalizedInput.startsWith('/')) {
      const cmd = normalizedInput;
      if (cmd === '/exit' || cmd === '/quit') {
        console.log(`${colors.green}Goodbye! 👋${colors.reset}\n`);
        rl.close();
        return;
      } else if (cmd === '/help') {
        console.log(`${colors.dim}Commands: /exit, /quit, /help, /stats${colors.reset}\n`);
      } else if (cmd === '/stats') {
        await showStats();
      } else {
        console.log(`${colors.red}Unknown command: ${cmd}${colors.reset}\n`);
      }
      return;
    }

    if (normalizedInput === 'back' || normalizedInput === '13' && currentMenu !== 'MAIN_MENU' && currentMenu !== 'ASK_CHATBOT' && currentMenu !== 'AWAITING_WORK_ID') {
      currentMenu = 'MAIN_MENU';
      printMainMenu();
      return;
    }

    const GREETING_PATTERNS = /^(hi|hello|start|namaste|नमस्ते|hey|hi there)$/i;
    if (currentMenu === 'MAIN_MENU' && GREETING_PATTERNS.test(normalizedInput)) {
      printMainMenu();
      return;
    }

    switch (currentMenu) {
      case 'MAIN_MENU':
        if (normalizedInput === '1') {
          currentMenu = 'ASK_CHATBOT';
          printAskChatbotMenu();
        } else if (normalizedInput === '2') {
          currentMenu = 'AWAITING_WORK_ID';
          console.log(`${colors.green}Assistant:${colors.reset} Please enter the Work ID.\n\nExample:\n2026-27/3333\n`);
        } else {
          console.log(`${colors.red}Invalid option. Please select 1 or 2.${colors.reset}\n`);
        }
        break;

      case 'ASK_CHATBOT':
        if (normalizedInput === 'back') {
          currentMenu = 'MAIN_MENU';
          printMainMenu();
          break;
        }

        const supportedQuestions = [
          "Voucher forward नहीं हो रहा है।",
          "How can I generate an FTO?",
          "Estimate approve कैसे करें?",
          "UC generate नहीं हो रही है。",
          "Final MB कैसे बनाएं?",
          "Vendor list में दिखाई नहीं दे रहा है。",
          "Work proposal submit नहीं हो रहा है。"
        ];

        let queryToSearch = input;
        
        // Allow user to put numbers to select a supported question
        if (/^[1-7]$/.test(normalizedInput)) {
          queryToSearch = supportedQuestions[parseInt(normalizedInput) - 1];
          console.log(`${colors.dim}Interpreted as: "${queryToSearch}"${colors.reset}\n`);
        } else if (normalizedInput.length < 3) {
          console.log(`${colors.red}Please provide a longer question so I can search the knowledge base effectively.${colors.reset}\n`);
          printAskChatbotMenu();
          break;
        }
        
        const searchInputLower = queryToSearch.toLowerCase();

        // Exact match fallback from requirements
        if (searchInputLower.includes('voucher forward') && searchInputLower.includes('नहीं')) {
          console.log(`${colors.green}Assistant:${colors.reset} Please verify the following:
1. The voucher is approved by the maker.
2. The checker role is properly mapped.
3. The voucher has not already been forwarded.
4. All mandatory documents are uploaded.
5. The voucher amount is within the available MB amount.\n`);
          printAskChatbotMenu();
          break;
        }

        console.log(`${colors.yellow}Searching knowledge base...${colors.reset}`);
        try {
          const results = await searchKnowledgeBase(queryToSearch, TOP_K);
          if (results.length === 0) {
            console.log(`${colors.green}Assistant:${colors.reset} I could not find an appropriate solution for this problem.\nPlease contact the e-Work Help Desk for further assistance.\n`);
            printAskChatbotMenu();
            break;
          }
          const context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
          console.log(`${colors.yellow}Generating response...${colors.reset}`);
          const response = await generateResponse(queryToSearch, context);
          console.log(`${colors.green}Assistant:${colors.reset} ${response}\n`);
          printAskChatbotMenu();
        } catch (error) {
          console.error(`${colors.red}Error:${colors.reset}`, error.message);
          printAskChatbotMenu();
        }
        break;

      case 'AWAITING_WORK_ID':
        if (normalizedInput === 'back') {
          currentMenu = 'MAIN_MENU';
          printMainMenu();
          break;
        }
        
        if (input === '2026-27/3333') {
          currentMenu = 'WORK_DETAILS_MENU';
          workId = input;
          console.log(`Work ID: 2026-27/3333
Work Name: Construction of Community Hall
Current Status: Work in Progress\n`);
          printWorkMenu();
        } else if (input.match(/^\d{4}-\d{2}\/\d+$/)) {
          console.log(`The entered Work ID was not found.\nPlease check the Work ID and try again.\n`);
        } else {
          console.log(`You are not authorized to view this work because it does not belong to your assigned location or agency.\n`);
        }
        break;

      case 'WORK_DETAILS_MENU':
        if (normalizedInput === '1') {
          console.log(`Work ID: 2026-27/3333
Work Name: Construction of Community Hall
Scheme: DDUGMGY
Financial Year: 2026-27
District: Jaipur
Block: Sanganer
Status: Work in Progress
Sanctioned Amount: ₹5,00,000
Physical Progress: 65%\n`);
        } else if (normalizedInput === '2') {
          console.log(`AS Number: AS/2026/125
AS Date: 15 July 2026
AS Amount: ₹5,00,000
Status: Approved\n`);
        } else if (normalizedInput === '3') {
          console.log(`TS Number: TS/2026/102
TS Date: 18 July 2026
TS Amount: ₹4,80,000
Status: Approved\n`);
        } else if (normalizedInput === '4') {
          console.log(`FS Number: FS/2026/085
FS Date: 20 July 2026
FS Amount: ₹4,80,000
Status: Approved\n`);
        } else if (normalizedInput === '5') {
          console.log(`Estimate Amount: ₹4,75,000
Estimate Date: 18 July 2026
Estimate Type: Original
Status: Approved\n`);
        } else if (normalizedInput === '6') {
          console.log(`Current Status: Work in Progress
Physical Progress: 65%
Last Updated: 25 July 2026\n`);
        } else if (normalizedInput === '7') {
          console.log(`Work Stage: Structure Work
Upload Date: 25 July 2026
Physical Progress: 65%\n`);
        } else if (normalizedInput === '8') {
          console.log(`MB Number: 1
Type: Running MB
Amount: ₹1,25,000
Status: Approved

MB Number: 2
Type: Running MB
Amount: ₹1,50,000
Status: Approved

MB Number: 3
Type: Final MB
Amount: ₹1,75,000
Status: Pending Approval\n`);
        } else if (normalizedInput === '9') {
          console.log(`Voucher Number: VCH-2026-145
Voucher Date: 22 July 2026
Gross Amount: ₹1,25,000
Net Amount: ₹1,18,500
Status: Approved
FTO Status: Generated\n`);
        } else if (normalizedInput === '10') {
          console.log(`FTO Number: FTO-2026-115
FTO Date: 24 July 2026
FTO Amount: ₹1,18,500
IFMS Status: Processed\n`);
        } else if (normalizedInput === '11') {
          console.log(`Utilization Certificate has not been generated for this work.\n`);
        } else if (normalizedInput === '12') {
          console.log(`Completion Certificate has not been generated for this work.\n`);
        } else {
          console.log(`${colors.red}Invalid option. Please select a number from 1-13.${colors.reset}\n`);
          break;
        }
        printWorkMenu();
        break;

      default:
        console.log(`${colors.red}Unknown state.${colors.reset}\n`);
        currentMenu = 'MAIN_MENU';
        printMainMenu();
        break;
    }
  });

  rl.on('close', () => {
    console.log(`\n${colors.green}Goodbye! 👋${colors.reset}\n`);
    process.exit(0);
  });

  async function showStats() {
    try {
      const { count } = await supabase.from('knowledge_base').select('*', { count: 'exact', head: true });
      const { count: embedCount } = await supabase.from('knowledge_base').select('*', { count: 'exact', head: true }).not('embedding', 'is', null);
      console.log(`${colors.cyan}Knowledge Base Stats:${colors.reset}`);
      console.log(`  Total documents: ${count}`);
      console.log(`  With embeddings: ${embedCount}\n`);
    } catch (error) {
      console.log(`${colors.red}Error: ${error.message}${colors.reset}\n`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});