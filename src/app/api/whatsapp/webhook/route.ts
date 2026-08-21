/**
 * WhatsApp Webhook Handler
 *
 * Handles incoming WhatsApp messages and sends responses.
 *
 * Message type support:
 *  - text        → standard text messages
 *  - interactive → button_reply / list_reply (tapped menu items)
 *
 * Menu strategy:
 *  - Welcome message → sends Interactive List Message (works on all numbers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processUserInput } from '@/lib/chatbot';
import { useChatStore } from '@/store/chatStore';
import { logAudit, checkUserRegistration } from '@/lib/database';
import { detectLanguage } from '@/lib/cohere';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'ework_whatsapp_verify_2024';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// ─── Webhook Verification (GET) ───────────────────────────────────────────────

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

// ─── Mark as Read ─────────────────────────────────────────────────────────────

async function markAsRead(messageId: string) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return;

  try {
    await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
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

// ─── Send Plain Text Message ──────────────────────────────────────────────────

async function sendWhatsAppMessage(to: string, message: string) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
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

// ─── Send Interactive List Message ───────────────────────────────────────────
// Works with ALL numbers including test numbers.
// Renders as a tappable list UI — similar experience to radio buttons.

async function sendMainMenuInteractiveList(to: string) {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            header: {
              type: 'text',
              text: '🏗️ e-Work Assistant',
            },
            body: {
              text: 'Welcome! Please select a service option to continue.',
            },
            footer: {
              text: 'Powered by e-Work Portal',
            },
            action: {
              button: 'Select Option',
              sections: [
                {
                  title: 'Available Services',
                  rows: [
                    {
                      id: '1',
                      title: '🤖 Ask e-Work Chatbot',
                      description: 'Get answers to e-Work queries & problems',
                    },
                    {
                      id: '2',
                      title: '📋 e-Work Information',
                      description: 'Check work status, payments & more',
                    },
                  ],
                },
              ],
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Interactive List] Failed to send:', JSON.stringify(error));
      // Fallback to plain text if interactive list also fails
      await sendWhatsAppMessage(
        to,
        'Please select an option:\n1. Ask e-Work Chatbot\n2. e-Work Information\n\nReply with 1 or 2.'
      );
    } else {
      console.log(`[Interactive List] Menu sent to ${to}`);
    }
  } catch (error) {
    console.error('[Interactive List] Error:', error);
  }
}

// ─── Session Store ────────────────────────────────────────────────────────────

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

// ─── Incoming Message Handler ─────────────────────────────────────────────────

async function handleIncomingMessage(from: string, messageBody: string): Promise<string> {
  const sid = 'whatsapp-' + from;
  let session = sessionStore.get(sid);

  if (!session) {
    let user = null;
    let isRegistered = false;
    try {
      user = await checkUserRegistration(from);
      isRegistered = !!user;
    } catch (e) {
      console.error("Error checking user registration:", e);
    }
    
    // Fallback for local testing if DB is not connected
    if (!user && (from === '+919999999999' || from === '919999999999' || from === '1234567890')) {
        user = {
          mobile_number: from,
          name: 'Paras Sharma',
          sso_id: 'SSO001',
          role: 'District User',
          user_level: 'District',
          district: 'Jaipur',
          block: 'Sanganer',
          gram_panchayat: 'Muralipura',
          department: 'Panchayati Raj',
          agency: 'DRDA',
          status: 'Active'
        } as any;
        isRegistered = true;
    }

    session = {
      id: sid,
      currentMenu: 'MAIN_MENU',
      context: { workId: null },
      user: user,
      isRegistered: isRegistered,
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
    const response = await processUserInput(
      messageBody,
      {
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
      storeState
    );

    session.messages.push(
      { id: Date.now().toString(), role: 'user', content: messageBody, timestamp: Date.now() },
      { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: Date.now() + 1 }
    );
    sessionStore.set(sid, session);

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

// ─── Is Welcome / Main Menu Response ─────────────────────────────────────────

function isWelcomeResponse(response: string): boolean {
  return (
    response.includes('Please select an option:') ||
    response.includes('Welcome to the e-Work WhatsApp Assistant')
  );
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('WhatsApp webhook received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const messages = change.value.messages;

            if (messages) {
              for (const message of messages) {
                const from = message.from;
                const messageId = message.id;
                let messageBody = '';

                // ── Parse message type ──
                if (message.type === 'text') {
                  messageBody = message.text.body;
                } else if (message.type === 'interactive') {
                  // Handles both button_reply AND list_reply (tapped list item)
                  messageBody =
                    message.interactive.button_reply?.id ||
                    message.interactive.list_reply?.id ||
                    '';
                  console.log(`[Webhook] Interactive reply from ${from}: "${messageBody}"`);
                }

                if (messageBody && messageId) {
                  await markAsRead(messageId);
                  const response = await handleIncomingMessage(from, messageBody);

                  // ── Welcome response: send interactive list ──
                  if (isWelcomeResponse(response)) {
                    console.log(`[Webhook] Sending interactive list menu to ${from}`);
                    await sendMainMenuInteractiveList(from);
                  } else {
                    // All other responses — send as plain text
                    await sendWhatsAppMessage(from, response);
                  }
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