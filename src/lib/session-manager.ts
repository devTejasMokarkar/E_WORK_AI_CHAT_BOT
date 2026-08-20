import { MEMORY_CONFIG } from './memory-config';
import { summarizeTurns, estimateTurnTokens } from './summarizer';
import type { ChatSession, ChatMessage, ContextSummary, AIContext } from '@/types';

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialSession(): ChatSession {
  return {
    id: generateId(),
    mobileNumber: null,
    user: null,
    isRegistered: false,
    messages: [],
    currentMenu: 'MAIN_MENU',
    context: {},
    summaries: [],
    rollingBuffer: [],
    totalTurns: 0,
    migrated: false,
  };
}

export function migrateLegacySession(session: ChatSession): ChatSession {
  if (session.migrated) return session;

  const legacyMessages = session.messages || [];
  const userTurns = legacyMessages.filter((m) => m.role === 'user');
  const totalTurns = userTurns.length;

  const recentMessages = legacyMessages.slice(-MEMORY_CONFIG.MAX_BUFFER_TURNS);
  const olderMessages = legacyMessages.slice(0, -MEMORY_CONFIG.MAX_BUFFER_TURNS);

  return {
    ...session,
    rollingBuffer: recentMessages,
    summaries: [],
    totalTurns,
    migrated: true,
  };
}

function pruneBuffer(session: ChatSession): ChatSession {
  if (session.rollingBuffer.length <= MEMORY_CONFIG.MAX_BUFFER_TURNS) {
    return session;
  }
  return {
    ...session,
    rollingBuffer: session.rollingBuffer.slice(-MEMORY_CONFIG.MAX_BUFFER_TURNS),
  };
}

export async function maybeSummarize(session: ChatSession): Promise<ChatSession> {
  const { totalTurns, rollingBuffer } = session;
  
  if (totalTurns < MEMORY_CONFIG.MIN_TURNS_TO_SUMMARIZE) {
    return session;
  }

  if (totalTurns % MEMORY_CONFIG.SUMMARY_TRIGGER_TURNS !== 0) {
    return session;
  }

  const turnsToSummarize = Math.min(
    MEMORY_CONFIG.SUMMARY_TRIGGER_TURNS,
    rollingBuffer.length - MEMORY_CONFIG.MAX_BUFFER_TURNS
  );

  if (turnsToSummarize <= 0) {
    return session;
  }

  const oldestTurns = rollingBuffer.slice(0, turnsToSummarize);
  const summary = await summarizeTurns(oldestTurns);

  return {
    ...session,
    summaries: [...session.summaries, summary],
    rollingBuffer: rollingBuffer.slice(turnsToSummarize),
  };
}

export function addTurn(
  session: ChatSession,
  userMessage: string,
  assistantMessage: string
): ChatSession {
  const timestamp = Date.now();
  const userMsg: ChatMessage = {
    id: generateId(),
    role: 'user',
    content: userMessage,
    timestamp,
  };
  const assistantMsg: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: assistantMessage,
    timestamp: timestamp + 1,
  };

  let updated = {
    ...session,
    totalTurns: session.totalTurns + 1,
    rollingBuffer: [...session.rollingBuffer, userMsg, assistantMsg],
    messages: [...session.messages, userMsg, assistantMsg],
  };

  updated = pruneBuffer(updated);

  return updated;
}

export function getContextForAI(session: ChatSession): AIContext {
  const summariesText = session.summaries.map((s) => s.summary).join('\n\n---\n\n');
  const recentTurns = session.rollingBuffer.slice(-MEMORY_CONFIG.MAX_BUFFER_TURNS);
  const summaryTokens = session.summaries.reduce((sum, s) => sum + s.tokenCount, 0);
  const recentTokens = estimateTurnTokens(recentTurns);

  return {
    summaries: summariesText,
    recentTurns,
    totalTurns: session.totalTurns,
    estimatedTokens: summaryTokens + recentTokens,
  };
}

export function createSession(id?: string): ChatSession {
  const session = createInitialSession();
  if (id) {
    session.id = id;
  }
  return session;
}

export function getSessionStats(session: ChatSession): {
  totalTurns: number;
  summaryCount: number;
  bufferLength: number;
  estimatedTokens: number;
  nextSummaryAt: number | null;
} {
  const { totalTurns, summaries, rollingBuffer } = session;
  const { estimatedTokens } = getContextForAI(session);
  const nextSummaryAt =
    totalTurns >= MEMORY_CONFIG.MIN_TURNS_TO_SUMMARIZE
      ? totalTurns + (MEMORY_CONFIG.SUMMARY_TRIGGER_TURNS - (totalTurns % MEMORY_CONFIG.SUMMARY_TRIGGER_TURNS))
      : MEMORY_CONFIG.MIN_TURNS_TO_SUMMARIZE;

  return {
    totalTurns,
    summaryCount: summaries.length,
    bufferLength: rollingBuffer.length,
    estimatedTokens,
    nextSummaryAt: totalTurns >= MEMORY_CONFIG.MIN_TURNS_TO_SUMMARIZE ? nextSummaryAt : null,
  };
}