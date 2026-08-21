import './polyfill';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { processUserInput } from '../src/lib/chatbot';
import { useChatStore } from '../src/store/chatStore';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DEFAULT_PHONE = '+919999999999'; // Registered in fallback
let currentPhone = DEFAULT_PHONE;

const testSession = {
  id: 'whatsapp-test',
  mobileNumber: currentPhone,
  user: {
    mobile_number: currentPhone,
    name: 'Paras Sharma',
    sso_id: 'SSO001',
    role: 'District User',
    user_level: 'District',
    district: 'Jaipur',
    block: 'Sanganer',
    gram_panchayat: 'Muralipura',
    department: 'Panchayati Raj',
    agency: 'DRDA',
    status: 'Active'
  } as any,
  isRegistered: true,
  messages: [],
  currentMenu: 'MAIN_MENU' as any,
  context: { workId: undefined },
  summaries: [],
  rollingBuffer: [],
  totalTurns: 0,
  migrated: false
};

const storeState = {
  session: testSession,
  setMenu: (menu: any) => { testSession.currentMenu = menu; },
  setMobileNumber: (mobile: string) => { testSession.mobileNumber = mobile; },
  setUser: (user: any) => { testSession.user = user; testSession.isRegistered = !!user; },
  setWork: (work: any) => { testSession.context.workId = work.work_id; },
  addMessage: (msg: any) => { testSession.messages.push(msg as never); },
  clearMessages: () => { testSession.messages = []; }
};

console.log('--- e-Work WhatsApp Chatbot Tester ---');
console.log('Type your message and press enter. Type "exit" to quit.');
console.log('Commands:');
console.log('  /unregistered - Switch to an unregistered user');
console.log('  /registered   - Switch to a registered user (+919999999999)');
console.log('--------------------------------------\n');

// Trigger initial main menu by sending "Hi"
processInput("Hi");

function askQuestion() {
  rl.question('\nYou: ', (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    if (input === '/unregistered') {
      testSession.user = null;
      testSession.isRegistered = false;
      testSession.mobileNumber = '+910000000000';
      testSession.currentMenu = 'MAIN_MENU';
      console.log('[Switched to unregistered user]');
      processInput("Hi");
      return;
    }

    if (input === '/registered') {
      testSession.user = {
        mobile_number: DEFAULT_PHONE,
        name: 'Paras Sharma',
        role: 'District User',
        district: 'Jaipur'
      } as any;
      testSession.isRegistered = true;
      testSession.mobileNumber = DEFAULT_PHONE;
      testSession.currentMenu = 'MAIN_MENU';
      console.log('[Switched to registered user]');
      processInput("Hi");
      return;
    }

    processInput(input);
  });
}

async function processInput(input: string) {
  try {
    const response = await processUserInput(input, testSession, storeState);
    console.log(`\nBot:\n${response}`);
    askQuestion();
  } catch (error) {
    console.error('Error processing input:', error);
    askQuestion();
  }
}
