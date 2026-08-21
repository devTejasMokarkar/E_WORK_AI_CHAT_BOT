import { NextResponse } from 'next/server';
import { processUserInput } from '@/lib/chatbot';
import { useChatStore } from '@/store/chatStore';
import { createSession, addTurn, maybeSummarize, migrateLegacySession } from '@/lib/session-manager';
import { logAudit } from '@/lib/database';
import { detectLanguage } from '@/lib/cohere';
import type { ChatSession } from '@/types';

// Server-side session store (in production, use Redis or database)
const sessionStore = new Map<string, ChatSession>();

// Convert server session to client store format
function createSessionState(session: ChatSession) {
  return {
    session: {
      id: session.id,
      mobileNumber: session.mobileNumber,
      user: session.user,
      isRegistered: session.isRegistered,
      messages: session.messages,
      currentMenu: session.currentMenu,
      context: session.context,
      summaries: session.summaries,
      rollingBuffer: session.rollingBuffer,
      totalTurns: session.totalTurns,
      migrated: session.migrated,
    },
    setMenu: (menu: string) => {
      session.currentMenu = menu as any;
      sessionStore.set(session.id, session);
    },
    setMobileNumber: (mobile: string) => {
      session.mobileNumber = mobile;
      sessionStore.set(session.id, session);
    },
    setUser: (user: any) => {
      session.user = user;
      session.isRegistered = !!user;
      sessionStore.set(session.id, session);
    },
    setWork: (work: any) => {
      session.context.workId = work.work_id;
      sessionStore.set(session.id, session);
    },
    addMessage: (message: any) => {
      session.messages.push(message);
      sessionStore.set(session.id, session);
    },
    clearMessages: () => {
      session.messages = [];
      sessionStore.set(session.id, session);
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const sid = sessionId || 'session-' + Date.now();
    
    // Get or create session
    let session = sessionStore.get(sid);
    if (!session) {
      session = createSession(sid);
      sessionStore.set(sid, session);
    }

    // Migrate legacy session if needed
    session = migrateLegacySession(session);

    // Create store state for this session
    const storeState = createSessionState(session);
    
    // Use the shared chatbot logic
    const response = await processUserInput(message, {
      id: session.id,
      mobileNumber: session.mobileNumber,
      user: session.user,
      isRegistered: session.isRegistered,
      messages: session.messages,
      currentMenu: session.currentMenu,
      context: session.context,
      summaries: session.summaries,
      rollingBuffer: session.rollingBuffer,
      totalTurns: session.totalTurns,
      migrated: session.migrated,
    }, storeState);

    // Update session with new turn
    session = addTurn(session, message, response);
    session = await maybeSummarize(session);
    sessionStore.set(sid, session);

    // Log to audit
    const lang = detectLanguage(message);
    await logAudit(session.id, session.mobileNumber, message, response, lang, session.currentMenu);

    return NextResponse.json({
      response,
      sessionId: sid,
      currentMenu: session.currentMenu,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}