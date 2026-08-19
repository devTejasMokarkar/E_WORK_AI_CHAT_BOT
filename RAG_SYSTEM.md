# eWork RAG System Documentation

## Overview
This system implements a Retrieval-Augmented Generation (RAG) pipeline for the eWork Enterprise Knowledge Base PDF. It enables semantic search and question-answering over the document content.

## Architecture

```
PDF (uploads/) 
    → Text Extraction (pdf2json)
    → Chunking (500 chars, 50 overlap)
    → Embeddings (Cohere embed-english-v3.0)
    → Storage (Supabase knowledge_base table + pgvector)
    → Query (vector similarity search)
    → Answer Generation (Cohere command-r7b-12-2024)
```

## Database Schema

### `knowledge_base` table
```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  category VARCHAR(100),
  source VARCHAR(200),
  embedding vector(1024),  -- Added by ingestion script
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Vector Similarity Function
```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3
)
RETURNS TABLE (id uuid, content text, category text, source text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT kb.id, kb.content, kb.category, kb.source,
         1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run ingest:pdf` | Process PDF from `uploads/`, chunk text, generate embeddings, store in Supabase |
| `npm run chat:rag` | Interactive terminal chat with RAG (semantic search + LLM answer generation) |
| `npm run db:schema` | Create all database tables from `supabase/schema.sql` |
| `npm run db:vector-fn` | Add pgvector similarity search function (`match_documents`) |

## Usage

### 1. Initial Setup (one-time)
```bash
# Run database schema
npm run db:schema

# Add vector similarity function
npm run db:vector-fn
```

### 2. Ingest PDF
```bash
# Place PDF in uploads/ directory
# Then run:
npm run ingest:pdf
```

**Environment variables required:**
- `COHERE_API_KEY` - For embeddings and chat
- `NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION` - PostgreSQL connection string

### 3. Chat with RAG
```bash
npm run chat:rag
```

**Commands in chat:**
- `/help` - Show help
- `/stats` - Show knowledge base statistics
- `/clear` - Clear screen
- `/exit` or `/quit` - Exit

## Configuration

### Chunking Parameters (in `scripts/ingest-pdf.cjs`)
```javascript
const CHUNK_SIZE = 500;   // Characters per chunk
const OVERLAP = 50;       // Overlap between chunks
const BATCH_SIZE = 10;    // Embeddings per batch
```

### Search Parameters (in `scripts/chat-rag.cjs`)
```javascript
const TOP_K = 5;                    // Number of results
const SIMILARITY_THRESHOLD = 0.3;   // Minimum cosine similarity
```

## Data Flow

### Ingestion (`scripts/ingest-pdf.cjs`)
1. Read PDF from `uploads/`
2. Extract text using `pdf2json`
3. Chunk text with sentence-aware splitting
4. Generate embeddings via Cohere `embed-english-v3.0`
5. Store in `knowledge_base` with `embedding` column

### Query (`scripts/chat-rag.cjs`)
1. User enters question
2. Generate query embedding via Cohere `embed-english-v3.0` (inputType: `search_query`)
3. Vector similarity search in Supabase using `match_documents` RPC or direct query
4. Build context from top-K results
5. Generate answer via Cohere `command-r7b-12-2024` with context
6. Display answer with source citations

## File Structure

```
ework-chatbot/
├── uploads/
│   └── eWork_Enterprise_General_Information_Knowledge_Base.pdf
├── scripts/
│   ├── ingest-pdf.cjs           # PDF ingestion pipeline
│   ├── chat-rag.cjs             # Terminal RAG chat
│   ├── run-schema.cjs           # Database schema setup
│   └── add-vector-function.cjs  # pgvector RPC function
├── supabase/
│   └── schema.sql               # Database schema
├── src/lib/
│   ├── rag.ts                   # RAG service (Next.js API)
│   ├── cohere.ts                # Cohere client
│   └── supabase.ts              # Supabase client
└── RAG_SYSTEM.md                # This file
```

## Troubleshooting

### PDF not found
```bash
# Check uploads directory
ls uploads/
```

### Embeddings not generating
- Verify `COHERE_API_KEY` is set
- Check Cohere API quota

### Vector search not working
- Ensure `pgvector` extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- Run `npm run db:vector-fn` to create `match_documents` function
- Verify `embedding` column exists in `knowledge_base`

### Model not found errors
The system uses `command-r7b-12-2024` (updated from deprecated `command-r-plus`). Update if Cohere deprecates models.

## Environment Variables

Create `.env.local` with:
```env
COHERE_API_KEY=your_cohere_key
NEXT_PUBLIC_SUPABASE__DIRECT_CONNECTION=postgresql://user:pass@host:5432/db
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```