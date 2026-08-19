require('dotenv').config({ path: '.env.local' });
const { CohereClient } = require('cohere-ai');
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function test() {
  try {
    const response = await cohere.embed({
      texts: ['Estimate approve कैसे करें?'],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    });
    console.log('Response keys:', Object.keys(response));
    if (response.embeddings) {
      console.log('embeddings is array?', Array.isArray(response.embeddings));
      console.log('embeddings[0] is array?', Array.isArray(response.embeddings[0]));
    }
    if (response.embeddingsByType) {
      console.log('embeddingsByType:', Object.keys(response.embeddingsByType));
      if (response.embeddingsByType.float) {
         console.log('float is array?', Array.isArray(response.embeddingsByType.float));
         console.log('float[0] is array?', Array.isArray(response.embeddingsByType.float[0]));
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
