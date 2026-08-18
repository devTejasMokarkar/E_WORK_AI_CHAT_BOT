/**
 * e-Work Chatbot Processing Logic
 */
import { generateChatCompletion, detectLanguage } from './cohere';
import { checkUserRegistration, getWorkById, getSanctions, getMeasurementBooks, getVouchers, getWorkFTOs, getUtilizationCertificate, getCompletionCertificate, getWorkPhotos, logAudit, getTotalPayment, getWorkCountByStatus, getPendingFTOCount, getWorkPaymentSummary } from './database';
import { useChatStore } from '@/store/chatStore';
import type { ChatSession, Work, MenuState, EworkUser } from '@/types';

// Greeting patterns
const GREETING_PATTERNS = /^(hi|hello|start|namaste|नमस्ते|hey|hi there)$/i;

// Helper to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper to format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Process user input based on current menu state
export async function processUserInput(input: string, session: ChatSession): Promise<string> {
  const normalizedInput = input.trim().toLowerCase();
  const store = useChatStore.getState();
  
  // Handle back command
  if (normalizedInput === 'back' || normalizedInput === '0' || normalizedInput === 'exit') {
    return handleBack(session.currentMenu, store);
  }

  // Handle greetings at main menu
  if (session.currentMenu === 'MAIN_MENU' && GREETING_PATTERNS.test(normalizedInput)) {
    return getWelcomeMessage();
  }

  // Route based on current menu
  switch (session.currentMenu) {
    case 'MAIN_MENU':
      return handleMainMenu(input, store);
    case 'ASK_CHATBOT':
      return handleAskChatbot(input, session, store);
    case 'EWORK_INFO':
      return handleEworkInfo(input, store);
    case 'WORK_STATUS':
    case 'AWAITING_WORK_ID':
      return handleWorkStatus(input, session, store);
    case 'WORK_DETAILS':
      return handleWorkDetails(input, session, store);
    case 'ASK_AI':
      return handleAskAI(input, session, store);
    case 'ADMIN_SANCTION':
    case 'TECHNICAL_SANCTION':
    case 'FINANCIAL_SANCTION':
    case 'ESTIMATE':
    case 'WORK_PROGRESS':
    case 'WORK_PHOTOS':
    case 'MEASUREMENT_BOOK':
    case 'VOUCHER_DETAILS':
    case 'FTO_DETAILS':
    case 'PAYMENT_STATUS':
    case 'UTILIZATION_CERTIFICATE':
    case 'COMPLETION_CERTIFICATE':
      return handleWorkSubMenu(input, session.currentMenu, store);
    default:
      return 'Invalid option. Please try again.';
  }
}

function getWelcomeMessage(): string {
  return `Welcome to the e-Work WhatsApp Assistant.

Please select an option:
1. Ask e-Work Chatbot
2. e-Work Information`;
}

function handleBack(currentMenu: MenuState, store: ReturnType<typeof useChatStore.getState>): string {
  switch (currentMenu) {
    case 'ASK_CHATBOT':
    case 'EWORK_INFO':
    case 'WORK_STATUS':
    case 'ASK_AI':
      store.setMenu('MAIN_MENU');
      return getWelcomeMessage();
    case 'WORK_DETAILS':
      if (store.session.isRegistered) {
        store.setMenu('EWORK_INFO');
      } else {
        store.setMenu('MAIN_MENU');
      }
      return 'Select an option:\n1. Work Status\n2. Ask e-Work AI\n3. Main Menu';
    default:
      store.setMenu('WORK_DETAILS');
      return getWorkDetailsMenu();
  }
}

async function handleMainMenu(input: string, store: ReturnType<typeof useChatStore.getState>): Promise<string> {
  const normalizedInput = input.trim().toLowerCase();

  switch (normalizedInput) {
    case '1':
      store.setMenu('ASK_CHATBOT');
      return `You can ask questions about common e-Work problems in English, Hindi, or mixed language.

Examples:
- "Voucher forward नहीं हो रहा है।"
- "How can I generate an FTO?"
- "Estimate approve कैसे करें?"

Ask your question (or type "back" to return to main menu):`;
    case '2':
      store.setMenu('EWORK_INFO');
      // For now, we'll simulate registration check based on a demo mobile number
      // In production, this would capture the user's WhatsApp number
      const demoMobile = '+919999999999';
      store.setMobileNumber(demoMobile);
      
      const user = await checkUserRegistration(demoMobile);
      
      if (user) {
        store.setUser(user);
        store.setRegistered(true);
        return getRegisteredUserMenu(user);
      } else {
        store.setUser(null);
        store.setRegistered(false);
        return getUnregisteredUserMessage();
      }
    default:
      return 'Invalid option. Please select 1 or 2.';
  }
}

function getRegisteredUserMenu(user: EworkUser): string {
  return `Welcome, ${user.name}
Role: ${user.role}
District: ${user.district}

Please select an option:
1. Work Status
2. Ask e-Work AI
3. Main Menu`;
}

function getUnregisteredUserMessage(): string {
  return `Your mobile number is not registered in e-Work.
Work-related information cannot be displayed.

Please contact the e-Work administrator to update your mobile number.

You can still use:
- Ask e-Work Chatbot (for general problem-related questions)

Select an option:
1. Work Status
2. Ask e-Work AI
3. Main Menu`;
}

async function handleAskChatbot(input: string, session: ChatSession, store: ReturnType<typeof useChatStore.getState>): Promise<string> {
  // This would use RAG in production - returning mock response for now
  const mockAnswers: Record<string, string> = {
    'voucher forward': 'Please verify the following:\n1. The voucher is approved by the maker.\n2. The checker role is properly mapped.\n3. The voucher has not already been forwarded.\n4. All mandatory documents are uploaded.\n5. The voucher amount is within the available MB amount.',
    'fto': 'To generate an FTO:\n1. Ensure the voucher is approved.\n2. Go to Payment Module > FTO Generation.\n3. Select the voucher and click "Generate FTO".\n4. Verify the details and submit.',
    'estimate approve': 'To approve an estimate:\n1. Login as Technical Sanction authority.\n2. Go to Works > Estimate Approval.\n3. Select the work and review the estimate.\n4. Click "Approve" or "Reject" with comments.',
    'payment pending': 'Payment may be pending due to:\n1. FTO not yet generated\n2. FTO under processing in IFMS\n3. Bank details not updated\n4. Payment rejected by IFMS\n\nPlease check the FTO status in the Payment module.',
    'uc generate': 'To generate Utilization Certificate:\n1. Go to Works > Utilization Certificate.\n2. Select the work with completed measurements.\n3. Verify the expenditure details.\n4. Click "Generate UC".',
    'final mb': 'To create Final Measurement Book:\n1. Complete all running MBs.\n2. Go to Works > Measurement Book.\n3. Select "Final MB" type.\n4. Enter final measurements and submit for approval.',
    'vendor list': 'To add/view vendor list:\n1. Go to Admin > Vendor Management.\n2. Click "Add Vendor" to create new vendor.\n3. Ensure vendor has valid GST and bank details.',
    'work proposal': 'To submit work proposal:\n1. Go to Works > New Work Proposal.\n2. Fill in all required details.\n3. Upload necessary documents.\n4. Submit for approval.',
  };

  const lowerInput = input.toLowerCase();
  for (const [key, answer] of Object.entries(mockAnswers)) {
    if (lowerInput.includes(key)) {
      return answer;
    }
  }

  // If no match, return fallback
  return `I could not find an appropriate solution for this problem.

Please contact the e-Work Help Desk for further assistance.`;
}

function handleEworkInfo(input: string, store: ReturnType<typeof useChatStore.getState>): string {
  const normalizedInput = input.trim().toLowerCase();

  switch (normalizedInput) {
    case '1':
      store.setMenu('WORK_STATUS');
      return 'Please enter the Work ID (e.g., 2026-27/3333) or type "back":';
    case '2':
      if (store.session.isRegistered) {
        store.setMenu('ASK_AI');
        return 'Ask your question about work status, payments, or analytics:';
      } else {
        return 'This feature is only available for registered users. Please contact the administrator.';
      }
    case '3':
      store.setMenu('MAIN_MENU');
      return getWelcomeMessage();
    default:
      return 'Invalid option. Please select 1, 2, or 3.';
  }
}

async function handleWorkStatus(input: string, session: ChatSession, store: ReturnType<typeof useChatStore.getState>): Promise<string> {
  const workId = input.trim();
  
  // Validate work ID format
  if (!workId.match(/^\d{4}-\d{2}\/\d+$/)) {
    return 'Invalid Work ID format. Please use format: YYYY-YY/NUMBER (e.g., 2026-27/3333)';
  }

  const { work, authorized, error } = await getWorkById(workId, session.user);

  if (error || !work) {
    return 'The entered Work ID was not found.\nPlease check the Work ID and try again.';
  }

  if (!authorized) {
    return 'You are not authorized to view this work because it does not belong to your assigned location or agency.';
  }

  store.setWork(work);
  store.setMenu('WORK_DETAILS');
  
  return getWorkDetailsDisplay(work);
}

function getWorkDetailsMenu(): string {
  return `Work ID: ${useChatStore.getState().session.context.workId || 'N/A'}

Select the required information:
1. Work Details
2. Administrative Sanction
3. Technical Sanction
4. Financial Sanction
5. Estimate
6. Work Progress
7. Work Photos
8. Measurement Book
9. Voucher Details
10. FTO Details
11. Payment Status
12. Utilization Certificate
13. Completion Certificate
14. Main Menu`;
}

function getWorkDetailsDisplay(work: Work): string {
  return `Work ID: ${work.work_id}
Work Name: ${work.work_name}
Scheme: ${work.scheme_name}
Financial Year: ${work.financial_year}
District: ${work.district}
Block: ${work.block}
Status: ${work.status}
Sanctioned Amount: ${formatCurrency(work.sanctioned_amount)}
Physical Progress: ${work.physical_progress}%

${getWorkDetailsMenu()}`;
}

async function handleWorkDetails(input: string, session: ChatSession, store: ReturnType<typeof useChatStore.getState>): Promise<string> {
  const normalizedInput = input.trim().toLowerCase();
  const workId = session.context.workId;

  if (!workId) {
    return 'Work ID not found. Please search for a work first.';
  }

  // Get work data
  const { work } = await getWorkById(workId, session.user);
  if (!work) {
    return 'Work not found.';
  }

  const menuMap: Record<string, MenuState> = {
    '1': 'WORK_DETAILS',
    '2': 'ADMIN_SANCTION',
    '3': 'TECHNICAL_SANCTION',
    '4': 'FINANCIAL_SANCTION',
    '5': 'ESTIMATE',
    '6': 'WORK_PROGRESS',
    '7': 'WORK_PHOTOS',
    '8': 'MEASUREMENT_BOOK',
    '9': 'VOUCHER_DETAILS',
    '10': 'FTO_DETAILS',
    '11': 'PAYMENT_STATUS',
    '12': 'UTILIZATION_CERTIFICATE',
    '13': 'COMPLETION_CERTIFICATE',
    '14': 'MAIN_MENU',
  };

  const menu = menuMap[normalizedInput];
  if (!menu) {
    return 'Invalid option. Please select a number from 1-14.';
  }

  if (menu === 'MAIN_MENU') {
    store.setMenu('MAIN_MENU');
    return getWelcomeMessage();
  }

  store.setMenu(menu);

  // Generate content based on selection
  switch (menu) {
    case 'WORK_DETAILS':
      return getWorkDetailsDisplay(work);
    case 'ADMIN_SANCTION':
      return await getSanctionsDisplay(workId, 'Administrative');
    case 'TECHNICAL_SANCTION':
      return await getSanctionsDisplay(workId, 'Technical');
    case 'FINANCIAL_SANCTION':
      return await getSanctionsDisplay(workId, 'Financial');
    case 'ESTIMATE':
      return getEstimateDisplay(work);
    case 'WORK_PROGRESS':
      return getWorkProgressDisplay(work);
    case 'WORK_PHOTOS':
      return await getWorkPhotosDisplay(workId);
    case 'MEASUREMENT_BOOK':
      return await getMBDisplay(workId);
    case 'VOUCHER_DETAILS':
      return await getVoucherDisplay(workId);
    case 'FTO_DETAILS':
      return await getFTODisplay(workId);
    case 'PAYMENT_STATUS':
      return await getPaymentDisplay(workId);
    case 'UTILIZATION_CERTIFICATE':
      return await getUCDisplay(workId);
    case 'COMPLETION_CERTIFICATE':
      return await getCCDisplay(workId);
    default:
      return '';
  }
}

async function getSanctionsDisplay(workId: string, type: 'Administrative' | 'Technical' | 'Financial'): Promise<string> {
  const sanctions = await getSanctions(workId, type);
  
  if (sanctions.length === 0) {
    return `${type} Sanction\n\nNo ${type.toLowerCase()} sanction found for this work.`;
  }

  const s = sanctions[0];
  return `${type} Sanction

${type === 'Administrative' ? 'AS' : type === 'Technical' ? 'TS' : 'FS'} Number: ${s.sanction_number}
${type === 'Administrative' ? 'AS' : type === 'Technical' ? 'TS' : 'FS'} Date: ${formatDate(s.sanction_date)}
${type === 'Administrative' ? 'AS' : type === 'Technical' ? 'TS' : 'FS'} Amount: ${formatCurrency(s.amount)}
Status: ${s.status}

Press "back" to return to Work Details menu:`;
}

function getEstimateDisplay(work: Work): string {
  return `Estimate Details

Estimate Amount: ${formatCurrency(work.sanctioned_amount)}
Estimate Type: Original
Status: Approved (Assumed)

Press "back" to return to Work Details menu:`;
}

function getWorkProgressDisplay(work: Work): string {
  return `Work Progress

Current Status: ${work.status}
Physical Progress: ${work.physical_progress}%
Last Updated: ${formatDate(work.updated_at)}

Press "back" to return to Work Details menu:`;
}

async function getWorkPhotosDisplay(workId: string): Promise<string> {
  const photos = await getWorkPhotos(workId, 1);
  
  if (photos.length === 0) {
    return `Work Photo

No work photos available.

Press "back" to return to Work Details menu:`;
  }

  const photo = photos[0];
  return `Work Photo

Work Stage: ${photo.work_stage}
Upload Date: ${formatDate(photo.upload_date)}
Physical Progress: ${photo.physical_progress}%

(Note: Photo URL: ${photo.photo_url})

Press "back" to return to Work Details menu:`;
}

async function getMBDisplay(workId: string): Promise<string> {
  const mbs = await getMeasurementBooks(workId);
  
  if (mbs.length === 0) {
    return `Measurement Book Details

No measurement books found for this work.

Press "back" to return to Work Details menu:`;
  }

  let response = 'Measurement Book Details\n\n';
  for (const mb of mbs) {
    response += `MB Number: ${mb.mb_number}\n`;
    response += `Type: ${mb.mb_type}\n`;
    response += `Amount: ${formatCurrency(mb.amount)}\n`;
    response += `Status: ${mb.status}\n\n`;
  }

  return response + 'Press "back" to return to Work Details menu:';
}

async function getVoucherDisplay(workId: string): Promise<string> {
  const vouchers = await getVouchers(workId);
  
  if (vouchers.length === 0) {
    return `Voucher Details

No vouchers found for this work.

Press "back" to return to Work Details menu:`;
  }

  let response = 'Voucher Details\n\n';
  for (const v of vouchers) {
    response += `Voucher Number: ${v.voucher_number}\n`;
    response += `Voucher Date: ${formatDate(v.voucher_date)}\n`;
    response += `Gross Amount: ${formatCurrency(v.gross_amount)}\n`;
    response += `Net Amount: ${formatCurrency(v.net_amount)}\n`;
    response += `Status: ${v.status}\n`;
    response += `FTO Status: ${v.fto_status}\n\n`;
  }

  return response + 'Press "back" to return to Work Details menu:';
}

async function getFTODisplay(workId: string): Promise<string> {
  const ftos = await getWorkFTOs(workId);
  
  if (ftos.length === 0) {
    return `FTO Details

No FTOs found for this work.

Press "back" to return to Work Details menu:`;
  }

  let response = 'FTO Details\n\n';
  for (const fto of ftos) {
    response += `FTO Number: ${fto.fto_number}\n`;
    response += `FTO Date: ${formatDate(fto.fto_date)}\n`;
    response += `FTO Amount: ${formatCurrency(fto.amount)}\n`;
    response += `IFMS Status: ${fto.ifms_status}\n`;
    response += `Payment Status: ${fto.payment_status}\n\n`;
  }

  return response + 'Press "back" to return to Work Details menu:';
}

async function getPaymentDisplay(workId: string): Promise<string> {
  const vouchers = await getVouchers(workId);
  
  if (vouchers.length === 0) {
    return `Payment Status

No payment information available.

Press "back" to return to Work Details menu:`;
  }

  // Get latest voucher with payment
  const v = vouchers[0];
  
  return `Payment Status

Voucher Number: ${v.voucher_number}
Payment Amount: ${formatCurrency(v.net_amount)}
Status: ${v.fto_status === 'Processed' ? 'Successful' : 'Pending'}
UTR Number: SBIN${Date.now()}
Payment Date: ${formatDate(new Date().toISOString())}

(Note: This is demo data)

Press "back" to return to Work Details menu:`;
}

async function getUCDisplay(workId: string): Promise<string> {
  const uc = await getUtilizationCertificate(workId);
  
  if (!uc) {
    return `Utilization Certificate

Utilization Certificate has not been generated for this work.

Press "back" to return to Work Details menu:`;
  }

  return `Utilization Certificate

UC Number: ${uc.uc_number}
UC Date: ${formatDate(uc.uc_date)}
UC Amount: ${formatCurrency(uc.amount)}
Status: ${uc.status}

Press "back" to return to Work Details menu:`;
}

async function getCCDisplay(workId: string): Promise<string> {
  const cc = await getCompletionCertificate(workId);
  
  if (!cc) {
    return `Completion Certificate

Completion Certificate has not been generated for this work.

Press "back" to return to Work Details menu:`;
  }

  return `Completion Certificate

CC Number: ${cc.cc_number}
CC Date: ${formatDate(cc.cc_date)}
Completion Amount: ${formatCurrency(cc.completion_amount)}
Status: ${cc.status}

Press "back" to return to Work Details menu:`;
}

async function handleAskAI(input: string, session: ChatSession, store: ReturnType<typeof useChatStore.getState>): Promise<string> {
  const user = session.user;
  
  if (!user) {
    return 'This feature is only available for registered users.';
  }

  const lowerInput = input.toLowerCase();
  const currentFY = '2026-27';

  // Parse different query types
  if (lowerInput.includes('proposed') && lowerInput.includes('work')) {
    const count = await getWorkCountByStatus(user, 'Proposed');
    return `Proposed Work Summary

Financial Year: ${currentFY}
District: ${user.district}
Total Proposed Works: ${count}`;
  }

  if (lowerInput.includes('payment') && (lowerInput.includes('total') || lowerInput.includes('current'))) {
    const total = await getTotalPayment(user, currentFY);
    return `Payment Summary

Financial Year: ${currentFY}
District: ${user.district}
Total Payment: ${formatCurrency(total)}`;
  }

  if (lowerInput.includes('work id') || lowerInput.match(/202[0-9]-?\d{2}\/\d+/)) {
    // Extract work ID
    const match = input.match(/202[0-9]-?\d{2}\/\d+/);
    if (match) {
      const workId = match[0].replace('-', '/');
      const summary = await getWorkPaymentSummary(workId);
      return `Payment Summary

Work ID: ${workId}
Total Voucher Amount: ${formatCurrency(summary.totalVoucher)}
Successful Payment: ${formatCurrency(summary.successfulPayment)}
Pending Payment: ${formatCurrency(summary.pendingPayment)}`;
    }
  }

  if (lowerInput.includes('pending') && lowerInput.includes('fto')) {
    const count = await getPendingFTOCount(user);
    return `Pending FTO Count

Your district: ${user.district}
Pending FTOs: ${count}`;
  }

  if (lowerInput.includes('how many') && lowerInput.includes('work') && lowerInput.includes('progress')) {
    const count = await getWorkCountByStatus(user, 'Work in Progress');
    return `Works in Progress

District: ${user.district}
Total Works in Progress: ${count}`;
  }

  // Default response for unhandled queries
  return `I understand you're asking about: "${input}"

Available queries:
- "How many works were proposed in the current financial year?"
- "Show total payment for the current financial year."
- "Show payment details of Work ID X"
- "Show pending FTO count"
- "How many works are currently in progress?"

Please try a different question or type "back".`;
}

async function handleWorkSubMenu(
  input: string, 
  currentMenu: MenuState, 
  store: ReturnType<typeof useChatStore.getState>
): Promise<string> {
  const normalizedInput = input.trim().toLowerCase();
  
  if (normalizedInput === 'back') {
    store.setMenu('WORK_DETAILS');
    return getWorkDetailsMenu();
  }

  // Return the current menu content
  return handleWorkDetails('1', store.session, store);
}