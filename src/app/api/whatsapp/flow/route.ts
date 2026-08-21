/**
 * WhatsApp Flow Data Exchange Endpoint
 *
 * Meta calls this endpoint when:
 *  - action: "ping"          → health check
 *  - action: "INIT"          → flow is opened (return initial screen data)
 *  - action: "data_exchange" → user interacts (radio select or footer button)
 *
 * Mode is controlled by WHATSAPP_FLOW_MODE env var:
 *  - "dev"  → plaintext JSON (no encryption) — use for local testing
 *  - "prod" → AES-256-GCM encrypted          — required for published flows
 *
 * Test this endpoint locally with:
 *   curl -X POST http://localhost:3000/api/whatsapp/flow \
 *     -H "Content-Type: application/json" \
 *     -d '{"version":"3.0","action":"INIT","flow_token":"test-token"}'
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  decryptFlowRequest,
  encryptFlowResponse,
  buildDemoScreenResponse,
  buildSuccessResponse,
  buildPingResponse,
  extractPhoneFromFlowToken,
  type FlowEncryptedBody,
  type FlowRequestPayload,
  type FlowResponsePayload,
} from '@/lib/whatsapp-flow';

const FLOW_MODE = process.env.WHATSAPP_FLOW_MODE || 'dev';
const FLOW_PRIVATE_KEY = process.env.WHATSAPP_FLOW_PRIVATE_KEY || '';

// ─── Request Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log(`[Flow Endpoint] Received request — mode: ${FLOW_MODE}`);

  try {
    let decryptedPayload: FlowRequestPayload;
    let aesKey: Buffer | undefined;
    let iv: Buffer | undefined;

    // ── Step 1: Parse / Decrypt incoming body ──
    if (FLOW_MODE === 'prod') {
      // Production: Meta sends AES-128-GCM encrypted payload
      if (!FLOW_PRIVATE_KEY) {
        console.error('[Flow Endpoint] WHATSAPP_FLOW_PRIVATE_KEY is not set in prod mode');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
      }

      const body: FlowEncryptedBody = await request.json();
      const decrypted = decryptFlowRequest(body, FLOW_PRIVATE_KEY);
      decryptedPayload = decrypted.decryptedBody;
      aesKey = decrypted.aesKey;
      iv = decrypted.iv;

      console.log('[Flow Endpoint] Decrypted payload:', JSON.stringify(decryptedPayload, null, 2));
    } else {
      // Dev mode: plaintext JSON
      decryptedPayload = await request.json() as FlowRequestPayload;
      console.log('[Flow Endpoint] Plaintext payload:', JSON.stringify(decryptedPayload, null, 2));
    }

    // ── Step 2: Process the action ──
    const responsePayload = await processFlowAction(decryptedPayload);

    console.log('[Flow Endpoint] Response:', JSON.stringify(responsePayload, null, 2));

    // ── Step 3: Return response (encrypted in prod, plain in dev) ──
    if (FLOW_MODE === 'prod' && aesKey && iv) {
      const encrypted = encryptFlowResponse(responsePayload, aesKey, iv);
      return new NextResponse(encrypted, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error('[Flow Endpoint] Error:', error instanceof Error ? error.message : error);
    console.error('[Flow Endpoint] Stack:', error instanceof Error ? error.stack : '');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── Action Processor ─────────────────────────────────────────────────────────

async function processFlowAction(
  payload: FlowRequestPayload
): Promise<FlowResponsePayload> {
  const { action, flow_token, screen, data } = payload;

  console.log(`[Flow Endpoint] Action: ${action}, Screen: ${screen || 'N/A'}`);

  switch (action) {
    // ── Health check from Meta ──
    case 'ping':
      console.log('[Flow Endpoint] Ping received — responding healthy');
      return buildPingResponse();

    // ── Flow opened for the first time ──
    case 'INIT':
      console.log('[Flow Endpoint] Flow initialized — sending DEMO_SCREEN');
      return buildDemoScreenResponse(flow_token);

    // ── User interaction (radio select OR footer button) ──
    case 'data_exchange':
      return handleDataExchange(screen, data, flow_token);

    default:
      console.warn(`[Flow Endpoint] Unknown action: ${action}`);
      return buildDemoScreenResponse(flow_token);
  }
}

// ─── Data Exchange Handler ────────────────────────────────────────────────────

async function handleDataExchange(
  screen: string | undefined,
  data: Record<string, unknown> | undefined,
  flowToken: string | undefined
): Promise<FlowResponsePayload> {
  const currentScreen = screen || 'DEMO_SCREEN';
  const appointmentType = data?.appointment_type as string | undefined;

  console.log(`[Flow Endpoint] data_exchange on screen: ${currentScreen}`);
  console.log(`[Flow Endpoint] data:`, JSON.stringify(data, null, 2));

  // ── Radio button selection ──
  // User selected a radio option but hasn't clicked Continue yet.
  // We return the same screen with the selection echoed back.
  if (currentScreen === 'DEMO_SCREEN' && appointmentType && !data?.submit) {
    console.log(`[Flow Endpoint] Radio selected: ${appointmentType}`);

    // Optionally log the intermediate selection
    if (flowToken) {
      const phone = extractPhoneFromFlowToken(flowToken);
      if (phone) {
        console.log(`[Flow Endpoint] Interim selection from ${phone}: appointment_type=${appointmentType}`);
      }
    }

    // Return the same screen (keep radio selected)
    return {
      version: '3.0',
      screen: 'DEMO_SCREEN',
      data: {
        all_appointment_types: [
          { id: '1', title: 'Online' },
          { id: '2', title: 'In Person' },
        ],
      },
    };
  }

  // ── Footer "Continue" button clicked ──
  // This is the terminal action — user has confirmed their selection.
  if (appointmentType) {
    console.log(`[Flow Endpoint] User confirmed appointment_type: ${appointmentType}`);

    // Log the final submission
    if (flowToken) {
      const phone = extractPhoneFromFlowToken(flowToken);
      console.log(`[Flow Endpoint] Final submission from ${phone}: appointment_type=${appointmentType}`);
    }

    return buildSuccessResponse(appointmentType, flowToken);
  }

  // ── Fallback: no appointment type yet, show the screen again ──
  console.log('[Flow Endpoint] No appointment type in payload — re-showing DEMO_SCREEN');
  return buildDemoScreenResponse(flowToken);
}

// ─── GET handler for verification (optional) ──────────────────────────────────

export async function GET(request: NextRequest) {
  // Meta may call GET to verify the endpoint is reachable
  return NextResponse.json({
    status: 'ok',
    message: 'WhatsApp Flow endpoint is active',
    mode: FLOW_MODE,
  });
}
