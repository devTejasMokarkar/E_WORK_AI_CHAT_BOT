# WhatsApp Interactive List & Flow — Step-by-Step Build Notes

> This document captures the exact steps taken to implement WhatsApp interactive menus
> (list messages + flows) in the e-Work chatbot project.

---

## 🧠 Concept Overview

| Feature | Works on Test Number | Works on Real Number |
|---|---|---|
| Plain Text Messages | ✅ | ✅ |
| Interactive List Messages | ✅ | ✅ |
| Interactive Button Messages (≤3 buttons) | ✅ | ✅ |
| WhatsApp Flows (RadioButtonsGroup) | ❌ Blocked by Integrity | ✅ |

> **Key Learning:** WhatsApp Flows require a **verified real business phone number**.
> Test numbers (`+1 555-xxx-xxxx`) will always return `#139000 Blocked by Integrity`.

---

## 📦 Step 1 — Build the Flow JSON

This is the screen definition Meta renders inside WhatsApp.
The JSON describes UI components (RadioButtonsGroup, Footer, etc.)

```json
{
  "version": "7.3",
  "data_api_version": "3.0",
  "routing_model": {},
  "screens": [
    {
      "id": "DEMO_SCREEN",
      "terminal": true,
      "title": "Demo screen",
      "data": {
        "all_appointment_types": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" }
            }
          },
          "__example__": [
            { "id": "1", "title": "Online" },
            { "id": "2", "title": "In Person" }
          ]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "text_input_form",
            "children": [
              {
                "type": "RadioButtonsGroup",
                "name": "appointment_type",
                "label": "Appointment type",
                "description": "Choose your preferred appointment type",
                "required": true,
                "data-source": "${data.all_appointment_types}",
                "on-select-action": {
                  "name": "data_exchange",
                  "payload": {
                    "appointment_type": "${form.appointment_type}"
                  }
                }
              },
              {
                "type": "Footer",
                "label": "Continue",
                "on-click-action": {
                  "name": "data_exchange",
                  "payload": {}
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**Key fields:**
- `terminal: true` → this is the last screen (no next screen needed)
- `data-source` → binds radio options to the `all_appointment_types` array
- `on-select-action: data_exchange` → calls your backend every time user taps a radio button
- `Footer on-click-action: data_exchange` → calls your backend when user clicks "Continue"

---

## 🔑 Step 2 — Find Your WABA ID (WhatsApp Business Account ID)

You need the WABA ID (not the Phone Number ID) to create flows.
Use your access token to find it:

```bash
curl -s "https://graph.facebook.com/debug_token?\
input_token=YOUR_ACCESS_TOKEN\
&access_token=YOUR_ACCESS_TOKEN" \
| jq '.data.granular_scopes'
```

**Expected response:**
```json
[
  {
    "scope": "whatsapp_business_management",
    "target_ids": ["1628481135046008"]   ← This is your WABA ID
  },
  {
    "scope": "whatsapp_business_messaging",
    "target_ids": ["1628481135046008"]
  }
]
```

> For this project: **WABA ID = `1628481135046008`**

---

## 🏗️ Step 3 — Create the Flow (Get Flow ID)

Call the Flows API with your WABA ID to register the flow:

```bash
curl -s -X POST "https://graph.facebook.com/v26.0/YOUR_WABA_ID/flows" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"eWork Appointment Type","categories":["OTHER"]}'
```

**Expected response:**
```json
{
  "id": "1630510415356516",   ← This is your FLOW_ID
  "success": true,
  "validation_errors": []
}
```

> For this project: **FLOW_ID = `1630510415356516`**

---

## 📤 Step 4 — Upload the Flow JSON to Meta

Upload the screen JSON (from Step 1) as a `flow.json` asset:

```bash
FLOW_JSON='{ ...paste your full JSON here as single line... }'

curl -s -X POST "https://graph.facebook.com/v26.0/YOUR_FLOW_ID/assets" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "name=flow.json" \
  -F "asset_type=FLOW_JSON" \
  -F "file=@-;type=application/json" <<< "$FLOW_JSON"
```

**Expected response:**
```json
{
  "success": true,
  "validation_errors": []
}
```

> ⚠️ If `validation_errors` is not empty, fix the JSON before proceeding.

---

## 🔗 Step 5 — Set the Flow Endpoint URI

Tell Meta where to call when a user interacts with the flow
(radio button tap or Continue button press):

```bash
curl -s -X POST "https://graph.facebook.com/v26.0/YOUR_FLOW_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint_uri":"https://YOUR_TUNNEL_URL/api/whatsapp/flow"}'
```

**Expected response:**
```json
{ "success": true }
```

> For this project:
> **Endpoint = `https://rob-peak-recently-participating.trycloudflare.com/api/whatsapp/flow`**
>
> ⚠️ Cloudflared URLs change every restart. Update this after each tunnel restart.

---

## 🚀 Step 6 — Publish the Flow (Real Numbers Only)

```bash
curl -s -X POST "https://graph.facebook.com/v26.0/YOUR_FLOW_ID/publish" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Success response:**
```json
{ "success": true }
```

**Failure on test numbers:**
```json
{
  "error": {
    "message": "Blocked by Integrity",
    "code": 139000,
    "error_user_msg": "Integrity requirements not met."
  }
}
```

> ❌ Test numbers cannot publish flows. Use **DRAFT mode** for dev testing.
> ✅ `DRAFT` status still works for sending flows to whitelisted test numbers.

---

## ✅ Step 7 — Verify Flow Status

```bash
curl -s "https://graph.facebook.com/v26.0/YOUR_FLOW_ID?\
fields=id,name,status,categories,validation_errors,endpoint_uri" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" | jq .
```

**Expected:**
```json
{
  "id": "1630510415356516",
  "name": "eWork Appointment Type",
  "status": "DRAFT",
  "categories": ["OTHER"],
  "validation_errors": []
}
```

---

## 🧱 Step 8 — Code Files Built

### New Files Created

| File | Purpose |
|---|---|
| `src/lib/whatsapp-flow.ts` | Send flow messages, AES encryption/decryption helpers, token utilities |
| `src/app/api/whatsapp/flow/route.ts` | Flow data exchange endpoint (Meta calls this on every interaction) |

### Modified Files

| File | Change |
|---|---|
| `src/app/api/whatsapp/webhook/route.ts` | Handle `nfm_reply` (flow completion), send interactive list on welcome |
| `.env.local` | Added `WHATSAPP_FLOW_ID`, `WHATSAPP_FLOW_MODE`, `WHATSAPP_USE_FLOW`, `WHATSAPP_FLOW_PRIVATE_KEY` |

---

## 🔄 Step 9 — How the Flow Endpoint Works

Meta calls `POST /api/whatsapp/flow` with 3 possible actions:

| Action | When | Your Response |
|---|---|---|
| `ping` | Meta health check | Return `{ status: "active" }` |
| `INIT` | Flow opened by user | Return screen data (appointment types list) |
| `data_exchange` | User taps radio / clicks Continue | Return updated screen or SUCCESS |

### Test with curl (no WhatsApp needed):

```bash
# Health check
curl -X POST http://localhost:3000/api/whatsapp/flow \
  -H "Content-Type: application/json" \
  -d '{"version":"3.0","action":"ping"}'

# Flow opened
curl -X POST http://localhost:3000/api/whatsapp/flow \
  -H "Content-Type: application/json" \
  -d '{"version":"3.0","action":"INIT","flow_token":"test-token"}'

# User selected "In Person" and clicked Continue
curl -X POST http://localhost:3000/api/whatsapp/flow \
  -H "Content-Type: application/json" \
  -d '{"version":"3.0","action":"data_exchange","screen":"DEMO_SCREEN","flow_token":"ework-918329475440-abc123","data":{"appointment_type":"2"}}'
```

---

## ⚙️ Step 10 — Environment Variables Reference

```env
# .env.local

# Your WhatsApp phone number ID (from Meta Developer Portal)
WHATSAPP_PHONE_NUMBER_ID=1058805773992462

# Your access token
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxx

# Flow ID from Step 3
WHATSAPP_FLOW_ID=1630510415356516

# "dev" = plaintext JSON (no encryption, for local testing)
# "prod" = AES-256-GCM encrypted (required for published flows)
WHATSAPP_FLOW_MODE=dev

# false = use Interactive List Message (works with test numbers)
# true  = use WhatsApp Flow with RadioButtonsGroup (real business numbers only)
WHATSAPP_USE_FLOW=false

# Only needed when WHATSAPP_FLOW_MODE=prod
WHATSAPP_FLOW_PRIVATE_KEY=
```

---

## 🗺️ End-to-End Flow (When Real Number Available)

```
User sends "hi"
       ↓
Webhook receives text → chatbot returns welcome message
       ↓
Webhook detects welcome + WHATSAPP_USE_FLOW=true
       ↓
sendWhatsAppFlow() → sends interactive Flow message
       ↓
User opens Flow → RadioButtonsGroup shown
       ↓
User taps "Online" → on-select-action fires
       ↓
Meta POSTs to /api/whatsapp/flow {action:"data_exchange", data:{appointment_type:"1"}}
       ↓
Flow endpoint returns same screen (radio stays selected)
       ↓
User clicks "Continue" → Footer action fires
       ↓
Meta POSTs to /api/whatsapp/flow {action:"data_exchange", data:{appointment_type:"1"}}
       ↓
Flow endpoint returns SUCCESS response
       ↓
WhatsApp sends nfm_reply to /api/whatsapp/webhook
       ↓
Webhook parses appointment_type → routes to chatbot menu "1" or "2"
```

## 🗺️ Current Flow (Test Number — Interactive List)

```
User sends "hi"
       ↓
Webhook receives text → chatbot returns welcome message
       ↓
Webhook detects welcome + WHATSAPP_USE_FLOW=false
       ↓
sendMainMenuInteractiveList() → sends tappable list UI
       ↓
User taps "Ask e-Work Chatbot" → list_reply with id="1"
       ↓
Webhook receives interactive message with id="1"
       ↓
Routes to chatbot menu → same as typing "1"
```

---

## ⚠️ Important Gotchas

1. **Test numbers can't send Flows** — always `#139000 Blocked by Integrity`
2. **Cloudflared URL changes on restart** — re-run Step 5 every time tunnel restarts
3. **Flow status must be DRAFT or PUBLISHED** — a flow in ERROR state won't send
4. **`data_exchange` fires on EVERY radio tap** — not just on Continue click
5. **Encryption in prod mode** — Meta encrypts the payload; you must decrypt with your private key
6. **WABA ID ≠ Phone Number ID** — use debug_token to find the correct WABA ID
7. **Flow JSON must be minified** to one line when passing via `-F "file=@-"` in curl

---

## 📋 Quick Reference — All Curl Commands

```bash
# Variables
TOKEN="YOUR_ACCESS_TOKEN"
WABA="1628481135046008"
FLOW_ID="1630510415356516"
TUNNEL="https://YOUR_TUNNEL.trycloudflare.com"

# 1. Get WABA ID
curl "https://graph.facebook.com/debug_token?input_token=$TOKEN&access_token=$TOKEN" | jq '.data.granular_scopes'

# 2. Create Flow
curl -X POST "https://graph.facebook.com/v26.0/$WABA/flows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"eWork Appointment Type","categories":["OTHER"]}'

# 3. Upload JSON
curl -X POST "https://graph.facebook.com/v26.0/$FLOW_ID/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -F "name=flow.json" -F "asset_type=FLOW_JSON" \
  -F "file=@-;type=application/json" <<< "YOUR_MINIFIED_JSON"

# 4. Set Endpoint
curl -X POST "https://graph.facebook.com/v26.0/$FLOW_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"endpoint_uri\":\"$TUNNEL/api/whatsapp/flow\"}"

# 5. Publish (real numbers only)
curl -X POST "https://graph.facebook.com/v26.0/$FLOW_ID/publish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# 6. Check Status
curl "https://graph.facebook.com/v26.0/$FLOW_ID?fields=id,name,status,validation_errors" \
  -H "Authorization: Bearer $TOKEN" | jq .
```
