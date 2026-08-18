#!/usr/bin/env node

/**
 * Interactive Terminal Interface for ework-chatbot
 * 
 * This provides a REPL interface to manually test the chatbot.
 */

const readline = require('readline');
const http = require('http');

// Configuration
const HOST = 'localhost';
const PORT = 3000;
const API_BASE = `http://${HOST}:${PORT}/api`;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${colors.cyan}chatbot> ${colors.reset}`
});

// Session state
let sessionId = `terminal-session-${Date.now()}`;
let conversationHistory = [];

console.log(`${colors.bright}${colors.green}╔══════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  e-Work Chatbot Terminal Testing Interface   ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}╠══════════════════════════════════════════════╣${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  Server: ${API_BASE}${colors.reset.padEnd(34 - API_BASE.length, ' ')}${colors.bright}${colors.green}║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  Session: ${sessionId}${colors.reset.padEnd(33 - sessionId.length, ' ')}${colors.bright}${colors.green}║${colors.reset}`);
console.log(`${colors.bright}${colors.green}╠══════════════════════════════════════════════╣${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  Available Commands:                         ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • Type your message to chat                 ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /health - Check API health                ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /session - Show current session info      ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /new - Start new session                  ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /history - Show conversation history      ║${colors.green}║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /clear - Clear conversation history       ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /help - Show this help message            ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}║  • /exit or Ctrl+C to quit                   ║${colors.reset}`);
console.log(`${colors.bright}${colors.green}╚══════════════════════════════════════════════╝${colors.reset}`);
console.log('');
console.log(`${colors.yellow}Try: "hello", "how can I generate FTO?", or "work status"${colors.reset}`);
console.log('');

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData,
            raw: true
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Chat with the chatbot
async function chatWithBot(message) {
  const startTime = Date.now();
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000
  };

  const requestData = {
    message,
    sessionId
  };

  try {
    console.log(`${colors.yellow}↳ Processing...${colors.reset}`);
    
    const response = await makeRequest(options, requestData);
    const elapsedTime = Date.now() - startTime;
    
    if (response.statusCode === 200) {
      // Add to conversation history
      conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      conversationHistory.push({
        role: 'bot',
        content: response.data.response,
        timestamp: new Date().toISOString()
      });
      
      // Print response
      console.log(`\n${colors.green}✓ Response (${elapsedTime}ms):${colors.reset}`);
      console.log(`${colors.blue}${formatResponse(response.data.response)}${colors.reset}\n`);
      
      // Show menu state if available
      if (response.data.currentMenu) {
        console.log(`${colors.magenta}Current Menu: ${response.data.currentMenu}${colors.reset}\n`);
      }
      
      return response.data.response;
    } else {
      console.log(`\n${colors.red}✗ Error: ${response.statusCode}${colors.reset}`);
      if (response.data.error) {
        console.log(`   ${response.data.error}${colors.reset}`);
      }
    }
  } catch (error) {
    console.log(`\n${colors.red}✗ Request failed: ${error.message}${colors.reset}`);
  }
}

// Check health status
async function checkHealth() {
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  };

  try {
    console.log(`${colors.yellow}↳ Checking health...${colors.reset}`);
    const response = await makeRequest(options);
    
    if (response.statusCode === 200 && response.data.status === 'ok') {
      console.log(`\n${colors.green}✓ Server is healthy${colors.reset}`);
      console.log(`   Service: ${response.data.service}`);
      console.log(`   Version: ${response.data.version}`);
      console.log(`   Timestamp: ${response.data.timestamp}`);
    } else {
      console.log(`\n${colors.red}✗ Health check failed${colors.reset}`);
    }
  } catch (error) {
    console.log(`\n${colors.red}✗ Health check failed: ${error.message}${colors.reset}`);
  }
}

// Format response with indentation
function formatResponse(text) {
  // Split by newlines and add indentation
  return text.split('\n').map(line => `  ${line}`).join('\n');
}

// Show session info
function showSessionInfo() {
  console.log(`\n${colors.magenta}╔ Session Information ${'═'.repeat(40)}╗${colors.reset}`);
  console.log(`${colors.magenta}║ ID: ${sessionId}${colors.reset.padEnd(58 - sessionId.length, ' ')}${colors.magenta}║${colors.reset}`);
  console.log(`${colors.magenta}║ Messages in history: ${conversationHistory.length}${colors.reset.padEnd(42, ' ')}${colors.magenta}║${colors.reset}`);
  console.log(`${colors.magenta}╚${'═'.repeat(60)}╝${colors.reset}\n`);
}

// Show conversation history
function showConversationHistory() {
  if (conversationHistory.length === 0) {
    console.log(`\n${colors.yellow}No conversation history yet.${colors.reset}\n`);
    return;
  }
  
  console.log(`\n${colors.magenta}╔ Conversation History ${'═'.repeat(39)}╗${colors.reset}`);
  
  conversationHistory.forEach((entry, index) => {
    const roleLabel = entry.role === 'user' ? 'User' : 'Bot';
    const roleColor = entry.role === 'user' ? colors.blue : colors.green;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    console.log(`${colors.magenta}║ ${colors.reset}${index + 1}. [${timestamp}] ${roleColor}${roleLabel}${colors.reset}:`);
    
    // Truncate long messages for display
    const displayText = entry.content.length > 80 
      ? entry.content.substring(0, 77) + '...' 
      : entry.content;
    
    console.log(`   ${displayText}`);
    if (index < conversationHistory.length - 1) {
      console.log(`${colors.magenta}║ ${colors.reset}`);
    }
  });
  
  console.log(`${colors.magenta}╚${'═'.repeat(60)}╝${colors.reset}\n`);
}

// Handle special commands
function handleCommand(command) {
  const parts = command.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case '/health':
      checkHealth();
      break;
      
    case '/session':
      showSessionInfo();
      break;
      
    case '/new':
      sessionId = `terminal-session-${Date.now()}`;
      conversationHistory = [];
      console.log(`\n${colors.green}✓ Started new session: ${sessionId}${colors.reset}\n`);
      break;
      
    case '/history':
      showConversationHistory();
      break;
      
    case '/clear':
      conversationHistory = [];
      console.log(`\n${colors.green}✓ Conversation history cleared${colors.reset}\n`);
      break;
      
    case '/help':
      console.log(`\n${colors.bright}${colors.green}Available Commands:${colors.reset}`);
      console.log(`  ${colors.cyan}/health${colors.reset}      - Check API health`);
      console.log(`  ${colors.cyan}/session${colors.reset}     - Show current session info`);
      console.log(`  ${colors.cyan}/new${colors.reset}         - Start new session`);
      console.log(`  ${colors.cyan}/history${colors.reset}     - Show conversation history`);
      console.log(`  ${colors.cyan}/clear${colors.reset}       - Clear conversation history`);
      console.log(`  ${colors.cyan}/help${colors.reset}        - Show this help message`);
      console.log(`  ${colors.cyan}/exit${colors.reset}        - Exit the terminal`);
      console.log(`  ${colors.cyan}Ctrl+C${colors.reset}       - Exit the terminal`);
      console.log(`\n${colors.yellow}Just type a message to chat with the bot!${colors.reset}\n`);
      break;
      
    case '/exit':
    case '/quit':
      console.log(`\n${colors.green}Goodbye! 👋${colors.reset}\n`);
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log(`\n${colors.red}Unknown command: ${cmd}${colors.reset}`);
      console.log(`Type ${colors.cyan}/help${colors.reset} for available commands.\n`);
      break;
  }
}

// Main REPL loop
rl.prompt();

rl.on('line', async (input) => {
  const trimmedInput = input.trim();
  
  if (trimmedInput === '') {
    rl.prompt();
    return;
  }
  
  // Check if it's a command
  if (trimmedInput.startsWith('/')) {
    handleCommand(trimmedInput);
  } else {
    // It's a chat message
    await chatWithBot(trimmedInput);
  }
  
  rl.prompt();
}).on('close', () => {
  console.log(`\n${colors.green}Thank you for testing! Goodbye! 👋${colors.reset}\n`);
  process.exit(0);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n\n${colors.green}Exiting... Goodbye! 👋${colors.reset}\n`);
  rl.close();
  process.exit(0);
});