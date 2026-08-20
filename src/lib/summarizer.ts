import { cohere } from './cohere';
import { MEMORY_CONFIG } from './memory-config';
import type { ChatMessage, ContextSummary } from '@/types';

const SUMMARIZATION_PROMPT = `Summarize the following conversation turns into JSON:
{
  "summary": "concise narrative, max 300 tokens",
  "keyFacts": ["work_id:2026-27/3333", "user_prefers:hindi", "decision:chose_option_2", "entity:vendor_ABC", "amount:500000", "date:2026-01-15"],
  "language": "en|hi|mixed"
}

Extract: work IDs, user preferences, decisions made, entity names, amounts, dates, status changes
Ignore: greetings, menu navigation, back/exit commands, repeated questions
Language: detect from content

Conversation turns:`;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / MEMORY_CONFIG.TOKEN_ESTIMATE_RATIO);
}

function detectLanguage(text: string): 'en' | 'hi' | 'mixed' {
  const hindiRegex = /[\u0900-\u097F]/;
  const hindiMatches = text.match(hindiRegex);
  if (!hindiMatches) return 'en';
  if (hindiMatches.length > text.length * 0.3) return 'hi';
  return 'mixed';
}

export async function summarizeTurns(turns: ChatMessage[]): Promise<ContextSummary> {
  const conversationText = turns
    .map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n\n');

  const prompt = `${SUMMARIZATION_PROMPT}\n\n${conversationText}`;

  const response = await cohere.chat({
    model: MEMORY_CONFIG.SUMMARY_MODEL,
    message: prompt,
    preamble: 'You are a summarization engine. Output only valid JSON.',
    temperature: 0.3,
    maxTokens: MEMORY_CONFIG.MAX_SUMMARY_TOKENS,
  });

  const text = (response as { text?: string }).text ?? '{}';
  
  let parsed: { summary: string; keyFacts: string[]; language: 'en' | 'hi' | 'mixed' };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      summary: text.slice(0, MEMORY_CONFIG.MAX_SUMMARY_TOKENS * 4),
      keyFacts: [],
      language: detectLanguage(conversationText),
    };
  }

  const summaryText = parsed.summary.slice(0, MEMORY_CONFIG.MAX_SUMMARY_TOKENS * 4);
  const tokenCount = estimateTokens(summaryText) + parsed.keyFacts.reduce((sum, f) => sum + estimateTokens(f), 0);

  const userTurns = turns.filter((t) => t.role === 'user');
  const startTurn = userTurns[0]?.timestamp ?? Date.now();
  const endTurn = userTurns[userTurns.length - 1]?.timestamp ?? Date.now();

  return {
    id: `sum-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    turnRange: { start: startTurn, end: endTurn },
    summary: summaryText,
    keyFacts: parsed.keyFacts.slice(0, 20),
    language: parsed.language,
    tokenCount,
    createdAt: Date.now(),
  };
}

export function estimateTurnTokens(turns: ChatMessage[]): number {
  return turns.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}