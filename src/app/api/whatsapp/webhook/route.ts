import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'ework_whatsapp_verify_2024';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('WhatsApp webhook verification failed');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

async function markAsRead(messageId: string) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return;
  
  try {
    await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    );
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

async function sendWhatsAppMessage(to: string, message: string) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send WhatsApp message:', error);
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

import { processUserInput } from '@/lib/chatbot';
import { useChatStore } from '@/store/chatStore';
import { logAudit } from '@/lib/database';
import { detectLanguage } from '@/lib/cohere';

// Server-side session store for WhatsApp
const sessionStore = new Map<string, any>();

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

async function handleIncomingMessage(from: string, messageBody: string): Promise<string> {
  const sid = 'whatsapp-' + from;
  let session = sessionStore.get(sid);
  
  if (!session) {
    session = {
      id: sid,
      currentMenu: 'MAIN_MENU',
      context: { workId: null },
      user: null,
      isRegistered: false,
      mobileNumber: from,
      messages: [],
      summaries: [],
      rollingBuffer: [],
      totalTurns: 0,
      migrated: false,
    };
    sessionStore.set(sid, session);
  }

  const storeState = createSessionState(session);

  try {
    const response = await processUserInput(messageBody, {
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

    session.messages.push(
      { id: Date.now().toString(), role: 'user', content: messageBody, timestamp: Date.now() },
      { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() + 1 }
    );
    sessionStore.set(sid, session);

    // Log to audit
    const lang = detectLanguage(messageBody);
    await logAudit(session.id, session.mobileNumber, messageBody, response, lang, session.currentMenu);

    return response;
  } catch (error) {
    console.error('Error in handleIncomingMessage:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');
    return 'Sorry, I encountered an error processing your message. Please try again.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const messages = change.value.messages;
            const contacts = change.value.contacts;

            if (messages) {
              for (const message of messages) {
                const from = message.from;
                const messageId = message.id;
                let messageBody = '';

                if (message.type === 'text') {
                  messageBody = message.text.body;
                } else if (message.type === 'interactive') {
                  messageBody = message.interactive.button_reply?.id || 
                               message.interactive.list_reply?.id || '';
                }

                if (messageBody && messageId) {
                  await markAsRead(messageId);
                  const response = await handleIncomingMessage(from, messageBody);
                  await sendWhatsAppMessage(from, response);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}