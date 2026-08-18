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

function handleIncomingMessage(from: string, messageBody: string): string {
  const normalizedInput = messageBody.trim().toLowerCase();
  
  const GREETING_PATTERNS = /^(hi|hello|start|namaste|नमस्ते|hey|hi there)$/i;
  
  if (GREETING_PATTERNS.test(normalizedInput)) {
    return `Welcome to the e-Work WhatsApp Assistant.

Please select an option:
1. Ask e-Work Chatbot
2. e-Work Information`;
  }

  switch (normalizedInput) {
    case '1':
      return `You can ask questions about common e-Work problems in English, Hindi, or mixed language.

Examples:
- "Voucher forward नहीं हो रहा है।"
- "How can I generate an FTO?"
- "Estimate approve कैसे करें?"

Ask your question (or type "back" to return to main menu):`;
    case '2':
      return `Welcome, Demo User
Role: District User
District: Jaipur

Please select an option:
1. Work Status
2. Ask e-Work AI
3. Main Menu`;
    case 'back':
    case '0':
    case 'exit':
      return `Welcome to the e-Work WhatsApp Assistant.

Please select an option:
1. Ask e-Work Chatbot
2. e-Work Information`;
    default:
      const mockAnswers: Record<string, string> = {
        'voucher forward': 'Please verify the following:\n1. The voucher is approved by the maker.\n2. The checker role is properly mapped.\n3. The voucher has not already been forwarded.\n4. All mandatory documents are uploaded.\n5. The voucher amount is within the available MB amount.',
        'fto': 'To generate an FTO:\n1. Ensure the voucher is approved.\n2. Go to Payment Module > FTO Generation.\n3. Select the voucher and click "Generate FTO".\n4. Verify the details and submit.',
        'estimate approve': 'To approve an estimate:\n1. Login as Technical Sanction authority.\n2. Go to Works > Estimate Approval.\n3. Select the work and review the estimate.\n4. Click "Approve" or "Reject" with comments.',
        'payment pending': 'Payment may be pending due to:\n1. FTO not yet generated\n2. FTO under processing in IFMS\n3. Bank details not updated\n4. Payment rejected by IFMS\n\nPlease check the FTO status in the Payment module.',
      };

      for (const [key, answer] of Object.entries(mockAnswers)) {
        if (normalizedInput.includes(key)) {
          return answer;
        }
      }

      return `I could not find an appropriate solution for this problem.

Please contact the e-Work Help Desk for further assistance.`;
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
                  const response = handleIncomingMessage(from, messageBody);
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