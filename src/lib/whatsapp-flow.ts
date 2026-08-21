/**
 * WhatsApp Flows Helper
 *
 * Supports two modes:
 *  - "dev"  → plaintext JSON in/out (no encryption required)
 *  - "prod" → AES-256-GCM encrypted payloads (Meta requirement for published flows)
 *
 * Set WHATSAPP_FLOW_MODE=dev in .env.local for local development.
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowRequestPayload {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  flow_token?: string;
  screen?: string;
  data?: Record<string, unknown>;
}

export interface FlowResponsePayload {
  version: string;
  screen: string;
  data: Record<string, unknown>;
}

export interface FlowEncryptedBody {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
}

export interface AppointmentFlowData {
  appointment_type?: string; // "1" = Online, "2" = In Person
  flow_token?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FLOW_VERSION = '3.0';

export const APPOINTMENT_TYPES = [
  { id: '1', title: 'Online' },
  { id: '2', title: 'In Person' },
];

// ─── Encryption Helpers (Production Mode) ────────────────────────────────────

/**
 * Decrypt an incoming encrypted flow request from Meta.
 * Only used when WHATSAPP_FLOW_MODE=prod
 */
export function decryptFlowRequest(
  body: FlowEncryptedBody,
  privateKeyBase64: string
): { decryptedBody: FlowRequestPayload; aesKey: Buffer; iv: Buffer } {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    format: 'pem',
    type: 'pkcs8',
  });

  // Decrypt the AES key using RSA-OAEP-SHA256
  const encryptedAesKey = Buffer.from(body.encrypted_aes_key, 'base64');
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKey
  );

  // Decrypt the flow data using AES-128-GCM
  const iv = Buffer.from(body.initial_vector, 'base64');
  const encryptedData = Buffer.from(body.encrypted_flow_data, 'base64');

  // Last 16 bytes are the auth tag
  const authTagLength = 16;
  const encryptedBody = encryptedData.slice(0, -authTagLength);
  const authTag = encryptedData.slice(-authTagLength);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]);

  const decryptedBody: FlowRequestPayload = JSON.parse(
    decryptedBuffer.toString('utf-8')
  );

  return { decryptedBody, aesKey, iv };
}

/**
 * Encrypt a flow response to send back to Meta.
 * Only used when WHATSAPP_FLOW_MODE=prod
 */
export function encryptFlowResponse(
  response: FlowResponsePayload,
  aesKey: Buffer,
  iv: Buffer
): string {
  // Flip the IV (XOR each byte with 0xFF)
  const flippedIv = iv.map((b) => b ^ 0xff);

  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  const encryptedResponse = Buffer.concat([
    cipher.update(JSON.stringify(response), 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encryptedResponse.toString('base64');
}

// ─── Flow Response Builders ───────────────────────────────────────────────────

/**
 * Build the initial DEMO_SCREEN response with the appointment types list.
 */
export function buildDemoScreenResponse(flowToken?: string): FlowResponsePayload {
  return {
    version: FLOW_VERSION,
    screen: 'DEMO_SCREEN',
    data: {
      all_appointment_types: APPOINTMENT_TYPES,
      ...(flowToken ? { flow_token: flowToken } : {}),
    },
  };
}

/**
 * Build the SUCCESS/terminal response after user submits the form.
 */
export function buildSuccessResponse(
  appointmentTypeId: string,
  flowToken?: string
): FlowResponsePayload {
  const selectedType =
    APPOINTMENT_TYPES.find((t) => t.id === appointmentTypeId)?.title ||
    appointmentTypeId;

  return {
    version: FLOW_VERSION,
    screen: 'SUCCESS',
    data: {
      extension_message_response: {
        params: {
          flow_token: flowToken || 'unused',
          appointment_type: appointmentTypeId,
          appointment_type_label: selectedType,
        },
      },
    },
  };
}

/**
 * Build a ping/health-check response.
 */
export function buildPingResponse(): FlowResponsePayload {
  return {
    version: FLOW_VERSION,
    screen: 'DEMO_SCREEN',
    data: { status: 'active' },
  };
}

// ─── Send Flow Message ────────────────────────────────────────────────────────

/**
 * Send a WhatsApp Flow interactive message to a user.
 * This opens the Flow UI inside WhatsApp.
 */
export async function sendWhatsAppFlow(
  to: string,
  flowId: string,
  flowToken: string,
  options?: {
    bodyText?: string;
    ctaLabel?: string;
  }
): Promise<boolean> {
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('[WhatsApp Flow] Credentials not configured');
    return false;
  }

  if (!flowId) {
    console.error('[WhatsApp Flow] WHATSAPP_FLOW_ID is not set. Please create a flow in Meta Developer Portal first.');
    return false;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header: {
        type: 'text',
        text: 'e-Work Assistant',
      },
      body: {
        text: options?.bodyText || 'Please select your preferred option to continue.',
      },
      footer: {
        text: 'Powered by e-Work',
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_id: flowId,
          flow_cta: options?.ctaLabel || 'Select Option',
          flow_token: flowToken,
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'DEMO_SCREEN',
            data: {
              all_appointment_types: APPOINTMENT_TYPES,
            },
          },
        },
      },
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp Flow] Failed to send flow message:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log(`[WhatsApp Flow] Flow message sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('[WhatsApp Flow] Error sending flow message:', error);
    return false;
  }
}

// ─── Flow Token Utilities ─────────────────────────────────────────────────────

/**
 * Generate a unique flow token for a conversation.
 * This token ties the flow response back to the user's session.
 */
export function generateFlowToken(from: string): string {
  const timestamp = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(`${from}-${timestamp}`)
    .digest('hex')
    .slice(0, 16);
  return `ework-${from}-${hash}`;
}

/**
 * Extract the phone number from a flow token.
 */
export function extractPhoneFromFlowToken(token: string): string | null {
  // token format: "ework-<phone>-<hash>"
  const parts = token.split('-');
  if (parts.length >= 3 && parts[0] === 'ework') {
    return parts[1];
  }
  return null;
}
