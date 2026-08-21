import './polyfill';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { processUserInput } from '../src/lib/chatbot';
import type { ChatSession } from '../src/types';

const DEFAULT_PHONE = '+919999999999';
const testSession: ChatSession = {
  id: 'test-session-123',
  mobileNumber: DEFAULT_PHONE,
  user: {
    mobile_number: DEFAULT_PHONE,
    name: 'Paras Sharma',
    role: 'District User',
    district: 'Jaipur',
    block: '',
    panchayat: '',
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

async function runTests() {
  console.log("=== TEST 1: Registered User Flow ===");
  let reply = await processUserInput("Hi", testSession, storeState);
  console.log("Bot (Main Menu):\n" + reply + "\n");
  
  reply = await processUserInput("2", testSession, storeState);
  console.log("Bot (e-Work Info):\n" + reply + "\n");
  
  reply = await processUserInput("1", testSession, storeState);
  console.log("Bot (Work Status):\n" + reply + "\n");

  reply = await processUserInput("WRK-123", testSession, storeState);
  console.log("Bot (Work ID entry):\n" + reply + "\n");

  console.log("=== TEST 2: Unregistered User Flow ===");
  testSession.isRegistered = false;
  testSession.user = null;
  testSession.currentMenu = 'MAIN_MENU';
  
  reply = await processUserInput("Hi", testSession, storeState);
  console.log("Bot (Main Menu):\n" + reply + "\n");

  reply = await processUserInput("2", testSession, storeState);
  console.log("Bot (e-Work Info):\n" + reply + "\n");
}

runTests();

async function runDetailTests() {
  // Reset session
  testSession.isRegistered = true;
  testSession.user = { mobile_number: '+919999999999', name: 'Paras Sharma', role: 'District User', user_level: 'District', district: 'Jaipur', block: '', gram_panchayat: '', agency: 'DRDA', status: 'Active' } as any;
  testSession.currentMenu = 'AWAITING_WORK_ID';
  
  console.log("\n=== TEST 3: Work ID + All Modules ===");
  let r = await processUserInput("2026-27/3333", testSession, storeState);
  console.log("Bot (Work found):\n" + r.substring(0, 300));
  
  r = await processUserInput("2", testSession, storeState);
  console.log("\nBot (Admin Sanction):\n" + r);
  
  r = await processUserInput("back", testSession, storeState);
  r = await processUserInput("3", testSession, storeState);
  console.log("\nBot (Technical Sanction):\n" + r);

  r = await processUserInput("back", testSession, storeState);
  r = await processUserInput("8", testSession, storeState);
  console.log("\nBot (Measurement Books):\n" + r);

  r = await processUserInput("back", testSession, storeState);
  r = await processUserInput("9", testSession, storeState);
  console.log("\nBot (Vouchers):\n" + r);

  r = await processUserInput("back", testSession, storeState);
  r = await processUserInput("10", testSession, storeState);
  console.log("\nBot (FTO Details):\n" + r);
  
  console.log("\n=== TEST 4: Unauthorized Work Access ===");
  testSession.user = { mobile_number: '+919888888888', name: 'Rajesh Kumar', role: 'Block User', user_level: 'Block', district: 'Jaipur', block: 'Virat Nagar', gram_panchayat: '', agency: 'Block Office', status: 'Active' } as any;
  testSession.currentMenu = 'AWAITING_WORK_ID';
  r = await processUserInput("2026-27/3333", testSession, storeState);
  console.log("Bot (Unauthorized):\n" + r);
}

runDetailTests();
