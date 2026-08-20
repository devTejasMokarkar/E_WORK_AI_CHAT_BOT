#!/usr/bin/env node

/**
 * sumchat - Interactive CLI for testing context memory & summarization
 * Usage: npm run chat:sum [options]
 * 
 * Options:
 *   --message, -m    Single message mode (non-interactive)
 *   --sessionId, -s  Session ID to continue
 *   --help, -h       Show help
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const WebSocket = require('ws');
(globalThis as any).WebSocket = WebSocket;

import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { cohere } from '../src/lib/cohere';
import { searchKnowledgeBase } from '../src/lib/rag';
import { generateChatCompletion, type ChatContext } from '../src/lib/cohere';
import { 
  createSession, 
  addTurn, 
  maybeSummarize, 
  migrateLegacySession,
  getContextForAI,
  getSessionStats 
} from '../src/lib/session-manager';
import { MEMORY_CONFIG } from '../src/lib/memory-config';
import type { ChatSession, ChatMessage, ContextSummary } from '../src/types';

interface CliSession extends ChatSession {
  // Extend for CLI-specific fields if needed
}

let session: CliSession;
let sessionId: string;

function parseArgs(): { message?: string; sessionId?: string; help: boolean } {
  const args = process.argv.slice(2);
  const result: { message?: string; sessionId?: string; help: boolean } = { help: false };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--message' || arg === '-m') {
      result.message = args[++i];
    } else if (arg === '--sessionId' || arg === '-s') {
      result.sessionId = args[++i];
    }
  }
  return result;
}

function printHelp(): void {
  console.log(`
sumchat - e-Work Chatbot with Context Memory & Summarization

Usage:
  npm run chat:sum                    # Interactive REPL mode
  npm run chat:sum -m "message"       # Single message mode
  npm run chat:sum -s <sessionId>     # Continue existing session
  npm run chat:sum -m "msg" -s <id>   # Single message with session

Commands (in REPL mode):
  /summary     - Show all summaries with token counts
  /buffer      - Show rolling buffer
  /turns       - Show turn stats
  /stats       - Show full session stats
  /migrate     - Show migration status
  /clear       - Reset session
  /help        - Show this help
  /exit        - Quit

Config:
  MAX_BUFFER_TURNS: ${MEMORY_CONFIG.MAX_BUFFER_TURNS}
  SUMMARY_TRIGGER_TURNS: ${MEMORY_CONFIG.SUMMARY_TRIGGER_TURNS}
  MIN_TURNS_TO_SUMMARIZE: ${MEMORY_CONFIG.MIN_TURNS_TO_SUMMARIZE}
  SUMMARY_MODEL: ${MEMORY_CONFIG.SUMMARY_MODEL}
`);
}

async function processMessage(message: string): Promise<string> {
  const results = await searchKnowledgeBase(message, 5);
  let context = 'No relevant information found in the knowledge base.';
  
  if (results.length > 0) {
    context = results.map((r, i) => `[Source ${i+1}: ${r.source}]\n${r.content}`).join('\n\n---\n\n');
  }

  const aiContext = getContextForAI(session);
  const chatContext: ChatContext = {
    summaries: aiContext.summaries,
    recentTurns: aiContext.recentTurns.map(m => ({ role: m.role as "user"|"assistant", content: m.content }))
  };

  const response = await generateChatCompletion(message, context, chatContext);
  return response;
}

function printSessionStats(): void {
  const stats = getSessionStats(session);
  console.log(`
════════════════════════════════════════════
SESSION STATS
════════════════════════════════════════════
Session ID: ${session.id}
Total Turns: ${stats.totalTurns}
Summaries: ${stats.summaryCount}
Buffer Length: ${stats.bufferLength}/${MEMORY_CONFIG.MAX_BUFFER_TURNS}
Estimated Tokens: ${stats.estimatedTokens}
Next Summary At: ${stats.nextSummaryAt || 'N/A'}
Migrated: ${session.migrated ? 'Yes' : 'No'}
════════════════════════════════════════════
`);
}

function printSummaries(): void {
  if (session.summaries.length === 0) {
    console.log('No summaries yet.');
    return;
  }
  
  console.log('\n═══ SUMMARIES ═══');
  session.summaries.forEach((s: ContextSummary, i: number) => {
    console.log(`\n[${i + 1}] Summary #${s.id} (${s.tokenCount} tokens)`);
    console.log(`    Turns: ${s.turnRange.start} - ${s.turnRange.end}`);
    console.log(`    Language: ${s.language}`);
    console.log(`    Key Facts: ${s.keyFacts.join(', ') || 'none'}`);
    console.log(`    Summary: ${s.summary.slice(0, 150)}${s.summary.length > 150 ? '...' : ''}`);
  });
  console.log('══════════════════\n');
}

function printBuffer(): void {
  if (session.rollingBuffer.length === 0) {
    console.log('Buffer is empty.');
    return;
  }
  
  console.log('\n═══ ROLLING BUFFER ═══');
  session.rollingBuffer.forEach((msg: ChatMessage, i: number) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : '');
    console.log(`  ${i + 1}. [${role}] ${content}`);
  });
  console.log('══════════════════════\n');
}

async function handleCommand(cmd: string): Promise<boolean> {
  const trimmed = cmd.trim().toLowerCase();
  
  switch (trimmed) {
    case '/summary':
      printSummaries();
      return true;
    case '/buffer':
      printBuffer();
      return true;
    case '/turns':
    case '/stats':
      printSessionStats();
      return true;
    case '/migrate':
      console.log(`Migration status: ${session.migrated ? 'Completed' : 'Pending'}`);
      console.log(`Legacy messages: ${session.messages.length}`);
      return true;
    case '/clear':
      session = createSession(sessionId);
      console.log('Session cleared.');
      return true;
    case '/help':
      printHelp();
      return true;
    case '/exit':
    case '/quit':
      console.log('Goodbye!');
      process.exit(0);
    default:
      return false;
  }
}

async function runInteractive(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  });

  console.log('\n═══ sumchat started ═══');
  console.log(`Session: ${sessionId}`);
  console.log('Type /help for commands, /exit to quit\n');
  
  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmed = input.trim();
    
    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.startsWith('/')) {
      const handled = await handleCommand(trimmed);
      if (!handled) {
        console.log(`Unknown command: ${trimmed}. Type /help for help.`);
      }
      rl.prompt();
      return;
    }

    try {
      console.log('...');
      const response = await processMessage(trimmed);
      console.log(`\nAssistant: ${response}\n`);
      
      session = addTurn(session, trimmed, response);
      session = await maybeSummarize(session);
      
      const stats = getSessionStats(session);
      console.log(`[Tokens: ~${stats.estimatedTokens} | Turn: ${stats.totalTurns} | Next summary at: ${stats.nextSummaryAt || 'N/A'}]\n`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
    
    rl.prompt();
  });
}

async function runSingleMessage(message: string): Promise<void> {
  try {
    const response = await processMessage(message);
    console.log(response);
    
    session = addTurn(session, message, response);
    session = await maybeSummarize(session);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  sessionId = args.sessionId || `cli-${Date.now()}`;
  session = createSession(sessionId);

  if (args.message) {
    await runSingleMessage(args.message);
  } else {
    await runInteractive();
  }
}

main().catch(console.error);