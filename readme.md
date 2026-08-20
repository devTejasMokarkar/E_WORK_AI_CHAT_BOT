1. Extract text from all 5 files in uploads/
2. Chunk them (500 chars, 50 overlap)
3. Generate Cohere embeddings
4. Store in Supabase knowledge_base with appropriate categories

npm run chat:rag - for rag chat
npm run chat:sum - for summarized chat and memory retention