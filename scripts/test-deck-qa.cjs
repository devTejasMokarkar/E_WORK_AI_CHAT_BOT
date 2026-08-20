#!/usr/bin/env node

/**
 * Run test cases against the RAG chatbot
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

const testCases = [
  // E-Work_Best_Practices
  {
    id: "bp_01",
    question: "How does e-Work ensure payments reach the right people without corruption or delay?",
    expectedKeyFacts: ["direct to beneficiary/vendor bank account", "OTP", "e-Sign", "secure payment"],
    source: "E-Work_Best_Practices"
  },
  {
    id: "bp_02",
    question: "What accountability mechanism does e-Work use across approval levels?",
    expectedKeyFacts: ["Maker-Checker-Approver", "all levels", "accountability", "transparency"],
    source: "E-Work_Best_Practices"
  },
  {
    id: "bp_03",
    question: "How many works does e-Work currently monitor?",
    expectedKeyFacts: ["2.1 lakh", "210,000", "single system"],
    source: "E-Work_Best_Practices"
  },
  // e-work_web_newest
  {
    id: "wn_01",
    question: "What happens once a voucher exceeds 80% of the FS (Financial Sanction) amount?",
    expectedKeyFacts: ["80%", "District CEO", "OTP", "additional approval"],
    source: "e-work_web_newest"
  },
  {
    id: "wn_02",
    question: "What security measures protect e-Work logins and approvals?",
    expectedKeyFacts: ["2 factor authentication", "SSO", "role based", "Maker", "Checker", "Approver", "OTP"],
    source: "e-work_web_newest"
  },
  {
    id: "wn_03",
    question: "How is a vendor verified before becoming eligible for payment?",
    expectedKeyFacts: ["Maker", "Checker", "Approver", "OTP", "eligible for payment"],
    source: "e-work_web_newest"
  },
  {
    id: "wn_04",
    question: "How can I generate an FTO?",
    expectedKeyFacts: ["voucher already approved", "Maker", "Checker", "Approver", "e-Signed", "IFMS", "PFMS"],
    source: "e-work_web_newest"
  },
  // mobileApp_MLA_Recommendation
  {
    id: "mla_01",
    question: "What are the two ways an MLA can submit a work recommendation?",
    expectedKeyFacts: ["mobile app", "Recommendation tab", "SSO web portal", "sso.rajasthan.gov.in"],
    source: "mobileApp_MLA_Recommendation"
  },
  {
    id: "mla_02",
    question: "What login credentials does an MLA need for the mobile app?",
    expectedKeyFacts: ["SSO ID", "password", "e-Work ID"],
    source: "mobileApp_MLA_Recommendation"
  },
  {
    id: "mla_03",
    question: "Can an MLA check the status of works they've recommended?",
    expectedKeyFacts: ["mobile app", "status", "recommended works"],
    source: "mobileApp_MLA_Recommendation"
  },
  // Gramin Vikas (Hindi)
  {
    id: "gv_01",
    question: "कार्य निर्माण करते समय कौन-कौन से दस्तावेज़ अपलोड करने अनिवार्य हैं?",
    expectedKeyFacts: ["Layout Upload", "Site Image Upload"],
    source: "Gramin_Vikas"
  },
  {
    id: "gv_02",
    question: "भुगतान प्रक्रिया में किस पोर्टल के माध्यम से राशि लाभार्थी के खाते में भेजी जाती है?",
    expectedKeyFacts: ["PFMS", "Direct Benefit Transfer", "DBT"],
    source: "Gramin_Vikas"
  },
  {
    id: "gv_03",
    question: "e-Work सिस्टम में कितने प्रकार की भूमिकाएं (roles) होती हैं और वे क्या करती हैं?",
    expectedKeyFacts: ["निर्माता", "परीक्षक", "अनुमोदक", "Creator", "Checker", "Approver"],
    source: "Gramin_Vikas"
  },
  // ework_doc (Functional Requirements)
  {
    id: "doc_01",
    question: "Voucher forward नहीं हो रहा है।",
    expectedKeyFacts: ["approved by the maker", "checker role", "not already been forwarded", "mandatory documents", "MB amount"],
    source: "ework_doc"
  },
  {
    id: "doc_02",
    question: "What is the Work ID used in the example throughout this document?",
    expectedKeyFacts: ["2026-27/3333"],
    source: "ework_doc"
  },
  {
    id: "doc_03",
    question: "What happens if my mobile number is not registered in e-Work?",
    expectedKeyFacts: ["not registered", "work-related information cannot be displayed", "contact the e-Work administrator", "Ask e-Work Chatbot", "still available"],
    source: "ework_doc"
  }
];

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function withRetry(fn, retries = MAX_RETRIES, delays = RETRY_DELAYS) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    const delay = delays[0] || 1000;
    console.log(`  Retrying in ${delay}ms... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delays.slice(1));
  }
}

async function generateQueryEmbedding(text) {
  return withRetry(async () => {
    const response = await cohere.embed({
      texts: [text],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
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
    throw new Error('Failed to generate query embedding');
  });
}

async function searchKnowledgeBase(query, topK = TOP_K) {
  const queryEmbedding = await generateQueryEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  const hasShortTerm = /\b(UC|FTO|MB|AS|TS|FS|CC)\b/i.test(query);
  const threshold = hasShortTerm ? 0.2 : SIMILARITY_THRESHOLD;
  
  const { data: results, error } = await supabase
    .rpc('match_documents', {
      query_embedding: embeddingStr,
      match_threshold: threshold,
      match_count: topK,
    });
  
  if (!error && results && results.length > 0) {
    return results.map(r => ({
      content: r.content,
      source: r.source || r.category || 'unknown',
      similarity: typeof r.similarity === 'string' ? parseFloat(r.similarity) : r.similarity,
    }));
  }
  
  return [];
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

  return withRetry(async () => {
    const response = await cohere.chat({
      model: 'command-r7b-12-2024',
      message: userPrompt,
      preamble: systemPrompt,
      temperature: 0.3,
      maxTokens: 500,
    });
    return response.text;
  }).catch(error => {
    console.error('Error generating response:', error.message);
    return 'Sorry, I encountered an error generating a response. Please try again.';
  });
}

async function askQuestion(query) {
  const results = await searchKnowledgeBase(query, TOP_K);
  
  if (results.length === 0) {
    return 'No relevant information found in the knowledge base.';
  }
  
  const context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
  
  const response = await generateResponse(query, context);
  return response;
}

async function runTests() {
  console.log('Running test cases against RAG chatbot...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const tc of testCases) {
    console.log(`[${tc.id}] ${tc.question}`);
    console.log(`  Source: ${tc.source}`);
    
    try {
      const answer = await askQuestion(tc.question);
      const lowerAnswer = answer.toLowerCase();
      
      const missingFacts = tc.expectedKeyFacts.filter(fact => 
        !lowerAnswer.includes(fact.toLowerCase())
      );
      
      if (missingFacts.length === 0) {
        console.log(`  ✅ PASSED`);
        passed++;
      } else {
        console.log(`  ❌ FAILED - Missing: ${missingFacts.join(', ')}`);
        console.log(`  Answer: ${answer.slice(0, 200)}...`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log(`RESULTS: ${passed}/${testCases.length} passed, ${failed} failed`);
  console.log('='.repeat(60));
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});