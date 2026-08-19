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
      console.log('Embeddings length:', response.embeddings.length);
      console.log('First embedding length:', response.embeddings[0].length);
    }
    if (response.embeddingsByType) {
      console.log('embeddingsByType:', Object.keys(response.embeddingsByType));
    }
    
    console.log('Chat test...');
    const chatRes = await cohere.chat({
      model: 'command',
      message: 'Hello'
    });
    console.log('Chat response:', chatRes.text);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
