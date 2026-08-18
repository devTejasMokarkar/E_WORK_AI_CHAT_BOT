#!/usr/bin/env node

/**
 * CLI Test Script for ework-chatbot
 * 
 * Usage:
 *   node test-cli.js [command] [options]
 * 
 * Commands:
 *   health     - Test server health
 *   chat       - Test chat API
 *   rag        - Test RAG API
 *   works      - Test works API
 *   all        - Test all APIs
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

function testHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200 && parsed.status === 'ok') {
            console.log('✅ Health check passed');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Service: ${parsed.service}`);
            console.log(`   Version: ${parsed.version}`);
          } else {
            console.log('❌ Health check failed');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response: ${data.substring(0, 200)}`);
          }
        } catch (error) {
          console.log('❌ Health check - Invalid JSON');
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log('❌ Health check error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.log('❌ Health check timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

function testChat() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: 'Hello, how are you?',
      sessionId: 'test-session-' + Date.now()
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('✅ Chat API test');
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response has data: ${!!parsed.response}`);
          if (parsed.error) {
            console.log(`   Error: ${parsed.error}`);
          }
        } catch (error) {
          console.log('❌ Chat API test - Invalid JSON response');
          console.log(`   Response: ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log('❌ Chat API error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.log('❌ Chat API timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(postData);
    req.end();
  });
}

function testRag() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: 'What is RAG?',
      sessionId: 'test-session-' + Date.now()
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/rag',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('✅ RAG API test');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response length: ${data.length} bytes`);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log('❌ RAG API error:', error.message);
      resolve(); // Don't reject, just note the error
    });

    req.on('timeout', () => {
      console.log('❌ RAG API timeout');
      req.destroy();
      resolve(); // Don't reject, just note the error
    });

    req.write(postData);
    req.end();
  });
}

function testWorks() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/works',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('✅ Works API test');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response length: ${data.length} bytes`);
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log('❌ Works API error:', error.message);
      resolve(); // Don't reject, just note the error
    });

    req.on('timeout', () => {
      console.log('❌ Works API timeout');
      req.destroy();
      resolve(); // Don't reject, just note the error
    });

    req.end();
  });
}

async function runTests(command) {
  console.log('🔧 Running CLI tests for ework-chatbot');
  console.log(`🔗 Server: http://${HOST}:${PORT}`);
  console.log('');

  try {
    switch(command) {
      case 'health':
        await testHealth();
        break;
      case 'chat':
        await testChat();
        break;
      case 'rag':
        await testRag();
        break;
      case 'works':
        await testWorks();
        break;
      case 'all':
        await testHealth();
        console.log('');
        await testChat();
        console.log('');
        await testRag();
        console.log('');
        await testWorks();
        break;
      default:
        console.log('❓ Unknown command. Available commands: health, chat, rag, works, all');
        console.log('');
        console.log('Usage: node test-cli.js [command]');
        console.log('Example: node test-cli.js all');
        break;
    }
  } catch (error) {
    console.log('💥 Test execution failed:', error.message);
  }
  
  console.log('');
  console.log('📋 Test completed');
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'health';

runTests(command);