import { NextResponse } from 'next/server';
import { processUserInput } from '@/lib/chatbot';
import { useChatStore } from '@/store/chatStore';

// Server-side session store (in production, use Redis or database)
const sessionStore = new Map<string, any>();

// Convert server session to client store format
function createSessionState(session: any) {
  return {
    session: {
      id: session.id,
      mobileNumber: session.mobileNumber,
      user: session.user,
      isRegistered: session.isRegistered,
      messages: session.messages,
      currentMenu: session.currentMenu,
      context: session.context,
    },
    setMenu: (menu: string) => {
      session.currentMenu = menu;
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
      session = {
        id: sid,
        currentMenu: 'MAIN_MENU',
        context: {
          workId: null,
        },
        user: null,
        isRegistered: false,
        mobileNumber: null,
        messages: []
      };
      sessionStore.set(sid, session);
    }

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
    }, storeState);

    // Update session messages
    session.messages.push(
      { id: Date.now().toString(), role: 'user', content: message, timestamp: Date.now() },
      { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() + 1 }
    );
    sessionStore.set(sid, session);

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