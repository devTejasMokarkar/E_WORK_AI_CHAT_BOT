/**
 * Cohere AI Service for Embeddings and Chat
 */
import { CohereClient } from 'cohere-ai';

const cohereApiKey = process.env.COHERE_API_KEY;

if (!cohereApiKey) {
  throw new Error('Missing COHERE_API_KEY environment variable');
}

export const cohere = new CohereClient({
  token: cohereApiKey,
});

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delays = RETRY_DELAYS): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    const delay = delays[0] || 1000;
    console.log(`Retrying in ${delay}ms... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delays.slice(1));
  }
}

/**
 * Generate embeddings for a text using Cohere
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await cohere.embed({
    texts: [text],
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });
  
  // Handle different response shapes
  const embeddings = (response as any).embeddings;
  if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
    return embeddings[0];
  } else if ((response as any).embeddingsByType && (response as any).embeddingsByType.float) {
    const floatEmbeddings = (response as any).embeddingsByType.float;
    if (Array.isArray(floatEmbeddings) && Array.isArray(floatEmbeddings[0])) {
      return floatEmbeddings[0];
    }
  }
  return [];
}

/**
 * Generate embeddings for multiple texts (query mode)
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  return withRetry(async () => {
    const response = await cohere.embed({
      texts: [text],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    });
    
    const embeddings = (response as any).embeddings;
    if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
      return embeddings[0];
    } else if ((response as any).embeddingsByType && (response as any).embeddingsByType.float) {
      const floatEmbeddings = (response as any).embeddingsByType.float;
      if (Array.isArray(floatEmbeddings) && Array.isArray(floatEmbeddings[0])) {
        return floatEmbeddings[0];
      }
    }
    throw new Error('Failed to generate query embedding');
  });
}

/**
 * Generate chat completion using Cohere
 */
export async function generateChatCompletion(
  message: string,
  context: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; text: string }> = []
): Promise<string> {
  const systemPrompt = `You are the e-Work WhatsApp Assistant, a helpful chatbot for e-Work portal users in India. 
Your role is to help users with:
1. Answering common questions about e-Work problems and workflows
2. Providing work-related information for registered users
3. Guiding users through the e-Work system

Guidelines:
- Be polite, helpful, and concise
- Provide step-by-step instructions when possible
- If you cannot find an answer, ask users to contact the e-Work Help Desk
- Support both English and Hindi (including mixed language)
- Only provide information that is explicitly asked for

Context from knowledge base:
${context}`;

  // Build the chat request
  const requestOptions: Record<string, unknown> = {
    model: 'command-r7b-12-2024',
    message,
    preamble: systemPrompt,
    temperature: 0.7,
    maxTokens: 500,
  };

  // Add chat history if available (using any to bypass strict typing issues)
  if (conversationHistory.length > 0) {
    const chatHistory = conversationHistory.slice(-5).map((msg) => ({
      role: msg.role === 'user' ? 'User' : 'Chatbot',
      message: msg.text,
    }));
    (requestOptions as { chatHistory?: unknown[] }).chatHistory = chatHistory;
  }

  return withRetry(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await cohere.chat(requestOptions as any);
    return (response as { text?: string }).text ?? 'I apologize, but I could not generate a response. Please try again.';
  }).catch(error => {
    console.error('Error generating response:', error);
    return 'Sorry, I encountered an error generating a response. Please try again.';
  });
}

/**
 * Detect language of input text
 */
export function detectLanguage(text: string): 'en' | 'hi' | 'mixed' {
  const hindiRegex = /[\u0900-\u097F]/;
  const hindiWords = text.match(hindiRegex);
  
  if (!hindiWords) return 'en';
  if (hindiWords.length > text.length * 0.3) return 'hi';
  return 'mixed';
}

export default cohere;