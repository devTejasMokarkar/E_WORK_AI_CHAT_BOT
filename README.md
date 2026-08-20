# eWork Chatbot

AI-powered WhatsApp chatbot for the e-Work portal (Rural Development Department, Rajasthan). Uses RAG (Retrieval-Augmented Generation) with Cohere embeddings and Supabase pgvector for knowledge base search.

## Features

- **RAG-based Q&A**: Answers 7 common e-Work troubleshooting questions using semantic search
- **Multi-language**: Supports English, Hindi, and mixed (Hinglish) queries
- **WhatsApp Integration**: Webhook endpoint for WhatsApp Business API
- **Work Information**: Registered users can query work status, payments, sanctions, MB, FTO, UC, CC
- **Session Management**: Persistent chat sessions with Zustand store
- **Knowledge Base**: 41 document chunks from PDF + 4 PPTX files + 7 structured Q&A pairs

## Supported Questions

1. `Voucher forward नहीं हो रहा है` - Voucher forwarding troubleshooting
2. `How can I generate an FTO?` - FTO generation process
3. `Estimate approve कैसे करें?` - Estimate approval workflow
4. `UC generate नहीं हो रही है` - Utilization Certificate issues
5. `Final MB कैसे बनाएं?` - Final Measurement Book creation
6. `Vendor list में दिखाई नहीं दे रहा है` - Vendor visibility problems
7. `Work proposal submit नहीं हो रहा है` - Work proposal submission issues

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account (PostgreSQL with pgvector)
- Cohere API key

### Installation

```bash
# Clone repository
git clone <repo-url>
cd ework-chatbot

# Install dependencies
npm ci

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION` | Direct Postgres connection string | Yes |
| `COHERE_API_KEY` | Cohere API key | Yes |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verify token | No |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID | No |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp access token | No |

### Database Setup

```bash
# Run schema (creates tables, indexes)
npm run db:schema

# Add pgvector match_documents RPC function
npm run db:vector-fn
```

### Knowledge Base Ingestion

```bash
# Ingest all documents (PDF + PPTX files from uploads/)
npm run ingest:all

# Ingest troubleshooting Q&A pairs
npm run ingest:qa
```

### Development

```bash
# Start dev server
npm run dev

# Run terminal chat for manual testing
npm run chat:rag

# Run RAG regression test
npm run test:qa
```

### Testing

```bash
# Unit + integration tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

### Linting & Type Checking

```bash
# Lint (ESLint + Prettier)
npm run lint

# TypeScript check
npm run typecheck
```

## Project Structure

```
ework-chatbot/
├── .github/workflows/ci.yml       # CI/CD pipeline
├── .husky/pre-commit              # Pre-commit hooks
├── data/
│   └── qa_pairs.json              # 7 structured Q&A pairs
├── scripts/
│   ├── ingest-all.cjs             # Ingest PDF + PPTX
│   ├── ingest-qa.cjs              # Ingest Q&A pairs
│   ├── test-all-qa.cjs            # RAG regression test
│   ├── chat-rag.cjs               # Terminal chat demo
│   ├── run-schema.cjs             # DB schema setup
│   └── add-vector-function.cjs    # pgvector RPC
├── src/
│   ├── app/api/
│   │   ├── chat/route.ts          # Main chat endpoint
│   │   ├── health/route.ts        # Health check
│   │   ├── rag/route.ts           # RAG query endpoint
│   │   ├── whatsapp/webhook/route.ts # WhatsApp webhook
│   │   └── works/route.ts         # Works data
│   ├── components/
│   │   └── TerminalChat.tsx       # Demo UI
│   ├── lib/
│   │   ├── chatbot.ts             # Core chatbot logic
│   │   ├── cohere.ts              # Cohere client
│   │   ├── database.ts            # DB queries
│   │   ├── rag.ts                 # RAG search
│   │   ├── supabase.ts            # Supabase client
│   │   └── whatsapp.ts            # WhatsApp helpers
│   ├── store/chatStore.ts         # Zustand session store
│   ├── types/index.ts             # TypeScript types
│   └── __tests__/
│       ├── unit/                  # Unit tests
│       ├── integration/           # Integration tests
│       ├── fixtures/              # Test fixtures
│       └── test-utils/            # Test helpers
├── supabase/
│   ├── schema.sql                 # Database schema
│   └── seed.sql                   # Seed data
├── uploads/                       # Source documents (gitignored)
├── .env.example                   # Env template
├── .eslintrc.json                 # ESLint config
├── .prettierrc                    # Prettier config
├── jest.config.ts                 # Jest config
├── next.config.ts                 # Next.js config
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## RAG Architecture

```
User Query
    │
    ▼
Cohere Embedding (embed-english-v3.0, search_query)
    │
    ▼
Supabase pgvector (match_documents RPC)
    │  ├── similarity_threshold: 0.3 (default)
    │  └── similarity_threshold: 0.2 (for UC/FTO/MB/AS/TS/FS/CC)
    ▼
Top-K Results (K=5)
    │
    ▼
Context Assembly → Cohere Chat (command-r7b-12-2024)
    │
    ▼
Generated Answer
```

## CI/CD Pipeline

The `.github/workflows/ci.yml` runs on every push/PR:

1. **Lint & Typecheck** - ESLint + TypeScript
2. **Tests** - Jest unit + integration tests
3. **RAG Regression** - Tests all 7 supported questions
4. **Build** - Next.js production build
5. **Deploy Preview** - Vercel preview for PRs
6. **Deploy Production** - Vercel production on main branch

Required secrets for CI:
- `COHERE_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (for deploy)

## Troubleshooting

### "No relevant information found"
- Run `npm run ingest:all` and `npm run ingest:qa`
- Check Supabase `knowledge_base` table has 41 rows with embeddings

### Cohere 404 model error
- Ensure using `command-r7b-12-2024` (not deprecated `command-r`)

### Supabase connection failed
- Verify `NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION` uses correct password
- Ensure pgvector extension is enabled

### Node.js version
- Requires Node.js 20.9+ for Next.js 16
- Use `nvm use 20` or update Node.js

## License

Internal use - Rural Development Department, Rajasthan