import { NextResponse } from 'next/server';

// Simple in-memory session store for testing
const sessionStore = new Map<string, any>();

// Simple chatbot logic that mimics the client-side behavior
function handleChatbotLogic(message: string, session: any): string {
  const normalizedInput = message.trim().toLowerCase();
  
  // Handle back command
  if (normalizedInput === 'back') {
    return handleBack(session);
  }
  
  // Handle greetings at main menu
  const GREETING_PATTERNS = /^(hi|hello|start|namaste|नमस्ते|hey|hi there)$/i;
  if (session.currentMenu === 'MAIN_MENU' && GREETING_PATTERNS.test(normalizedInput)) {
    return getWelcomeMessage();
  }
  
  // Route based on current menu
  switch (session.currentMenu) {
    case 'MAIN_MENU':
      return handleMainMenu(message, session);
    case 'ASK_CHATBOT':
      return handleAskChatbot(message, session);
    case 'EWORK_INFO':
      return handleEworkInfo(message, session);
    case 'WORK_STATUS':
      return handleWorkStatus(message, session);
    case 'WORK_DETAILS':
      return handleWorkDetails(message, session);
    case 'ASK_AI':
      return handleAskAI(message, session);
    default:
      return 'Invalid option. Please try again.';
  }
}

function handleBack(session: any): string {
  switch (session.currentMenu) {
    case 'ASK_CHATBOT':
    case 'EWORK_INFO':
    case 'WORK_STATUS':
    case 'ASK_AI':
      session.currentMenu = 'MAIN_MENU';
      return getWelcomeMessage();
    case 'WORK_DETAILS':
      if (session.isRegistered) {
        session.currentMenu = 'EWORK_INFO';
        return getRegisteredUserMenu(session.user);
      } else {
        session.currentMenu = 'MAIN_MENU';
        return getWelcomeMessage();
      }
    default:
      if (['ADMIN_SANCTION', 'TECHNICAL_SANCTION', 'FINANCIAL_SANCTION', 'ESTIMATE', 'WORK_PROGRESS', 'WORK_PHOTOS', 'MEASUREMENT_BOOK', 'VOUCHER_DETAILS', 'FTO_DETAILS', 'PAYMENT_STATUS', 'UTILIZATION_CERTIFICATE', 'COMPLETION_CERTIFICATE'].includes(session.currentMenu)) {
        session.currentMenu = 'WORK_DETAILS';
        return getWorkDetailsMenu(session);
      }
      session.currentMenu = 'MAIN_MENU';
      return getWelcomeMessage();
  }
}

function getWelcomeMessage(): string {
  return `Welcome to the e-Work WhatsApp Assistant.
Please select an option:
1. Ask e-Work Chatbot
2. e-Work Information`;
}

function handleMainMenu(input: string, session: any): string {
  const normalizedInput = input.trim().toLowerCase();

  switch (normalizedInput) {
    case '1':
      session.currentMenu = 'ASK_CHATBOT';
      return `You can ask questions about common e-Work problems in English, Hindi, or mixed language.

Examples:
- "Voucher forward नहीं हो रहा है।"
- "How can I generate an FTO?"
- "Estimate approve कैसे करें?"

Ask your question (or type "back" to return to main menu):`;
    case '2':
      session.currentMenu = 'EWORK_INFO';
      // Simulate registered user for demo
      session.user = { name: 'Paras Sharma', role: 'District User', district: 'Jaipur' };
      session.isRegistered = true;
      return getRegisteredUserMenu(session.user);
    default:
      return 'Invalid option. Please select 1 or 2.';
  }
}

function getRegisteredUserMenu(user: any): string {
  return `Welcome, ${user.name}
Role: ${user.role}
District: ${user.district}

Please select an option:
1. Work Status
2. Ask e-Work AI
3. Main Menu`;
}

function handleAskChatbot(input: string, session: any): string {
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
  
  // Check for matching answers
  for (const [key, answer] of Object.entries(mockAnswers)) {
    if (lowerInput.includes(key)) {
      return answer;
    }
  }

  // If no match, return fallback
  return `I could not find an appropriate solution for this problem.
Please contact the e-Work Help Desk for further assistance.`;
}

function handleEworkInfo(input: string, session: any): string {
  const normalizedInput = input.trim().toLowerCase();

  switch (normalizedInput) {
    case '1':
      session.currentMenu = 'WORK_STATUS';
      return 'Please enter the Work ID (e.g., 2026-27/3333) or type "back":';
    case '2':
      if (session.isRegistered) {
        session.currentMenu = 'ASK_AI';
        return 'Ask your question about work status, payments, or analytics:';
      } else {
        return 'This feature is only available for registered users. Please contact the administrator.';
      }
    case '3':
      session.currentMenu = 'MAIN_MENU';
      return getWelcomeMessage();
    default:
      return 'Invalid option. Please select 1, 2, or 3.';
  }
}

function handleWorkStatus(input: string, session: any): string {
  const workId = input.trim();
  
  // Basic validation
  if (!workId.match(/^\d{4}-\d{2}\/\d+$/)) {
    return 'Invalid Work ID format. Please use format: YYYY-YY/NUMBER (e.g., 2026-27/3333)';
  }
  
  if (workId === '2026-27/3333') {
    session.context.workId = workId;
    session.currentMenu = 'WORK_DETAILS';
    return getWorkDetailsMenu(session);
  } else {
    return 'The entered Work ID was not found.\nPlease check the Work ID and try again.';
  }
}

function getWorkDetailsMenu(session: any): string {
  return `Work ID: 2026-27/3333
Work Name: Construction of Community Hall
Current Status: Work in Progress

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

function handleWorkDetails(input: string, session: any): string {
  const normalizedInput = input.trim().toLowerCase();

  switch (normalizedInput) {
    case '1':
      session.currentMenu = 'WORK_DETAILS_INFO';
      return `Work Details
Work ID: 2026-27/3333
Work Name: Construction of Community Hall
Scheme: DDUGMGY
Financial Year: 2026-27
District: Jaipur
Block: Sanganer
Status: Work in Progress
Sanctioned Amount: ₹5,00,000
Physical Progress: 65%

Type "back" to return to the previous menu.`;
    case '2':
      session.currentMenu = 'ADMIN_SANCTION';
      return `Administrative Sanction
AS Number: AS/2026/125
AS Date: 15 July 2026
AS Amount: ₹5,00,000
Status: Approved

Type "back" to return.`;
    case '3':
      session.currentMenu = 'TECHNICAL_SANCTION';
      return `Technical Sanction
TS Number: TS/2026/102
TS Date: 18 July 2026
TS Amount: ₹4,80,000
Status: Approved

Type "back" to return.`;
    case '4':
      session.currentMenu = 'FINANCIAL_SANCTION';
      return `Financial Sanction
FS Number: FS/2026/085
FS Date: 20 July 2026
FS Amount: ₹4,80,000
Status: Approved

Type "back" to return.`;
    case '5':
      session.currentMenu = 'ESTIMATE';
      return `Estimate Details
Estimate Amount: ₹4,75,000
Estimate Date: 18 July 2026
Estimate Type: Original
Status: Approved

Type "back" to return.`;
    case '6':
      session.currentMenu = 'WORK_PROGRESS';
      return `Work Progress
Current Status: Work in Progress
Physical Progress: 65%
Last Updated: 25 July 2026

Type "back" to return.`;
    case '7':
      session.currentMenu = 'WORK_PHOTOS';
      return `Work Photo
Work Stage: Structure Work
Upload Date: 25 July 2026
Physical Progress: 65%

Type "back" to return.`;
    case '8':
      session.currentMenu = 'MEASUREMENT_BOOK';
      return `Measurement Book Details
MB Number: 1
Type: Running MB
Amount: ₹1,25,000
Status: Approved

MB Number: 2
Type: Running MB
Amount: ₹1,50,000
Status: Approved

MB Number: 3
Type: Final MB
Amount: ₹1,75,000
Status: Pending Approval

Type "back" to return.`;
    case '9':
      session.currentMenu = 'VOUCHER_DETAILS';
      return `Voucher Details
Voucher Number: VCH-2026-145
Voucher Date: 22 July 2026
Gross Amount: ₹1,25,000
Net Amount: ₹1,18,500
Status: Approved
FTO Status: Generated

Type "back" to return.`;
    case '10':
      session.currentMenu = 'FTO_DETAILS';
      return `FTO Details
FTO Number: FTO-2026-115
FTO Date: 24 July 2026
FTO Amount: ₹1,18,500
IFMS Status: Processed
Payment Status: Successful

Type "back" to return.`;
    case '11':
      session.currentMenu = 'PAYMENT_STATUS';
      return `Payment Status
Voucher Number: VCH-2026-145
Payment Amount: ₹1,18,500
Status: Successful
UTR Number: SBIN2026072500123
Payment Date: 25 July 2026

Type "back" to return.`;
    case '12':
      session.currentMenu = 'UTILIZATION_CERTIFICATE';
      return `Utilization Certificate
UC Number: UC-2026-102
UC Date: 27 July 2026
UC Amount: ₹4,50,000
Status: Approved

Type "back" to return.`;
    case '13':
      session.currentMenu = 'COMPLETION_CERTIFICATE';
      return `Completion Certificate
CC Number: CC-2026-075
CC Date: 30 July 2026
Completion Amount: ₹4,70,000
Status: Approved

Type "back" to return.`;
    case '14':
      session.currentMenu = 'MAIN_MENU';
      return getWelcomeMessage();
    default:
      return 'Invalid option. Please select a valid number.';
  }
}

function handleAskAI(input: string, session: any): string {
  return `Proposed Work Summary
Financial Year: 2026-27
District: Jaipur
Total Proposed Works: 100

Type "back" to return.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const sid = sessionId || 'test-session-' + Date.now();
    
    // Get or create session
    let session = sessionStore.get(sid);
    if (!session) {
      session = {
        id: sid,
        currentMenu: 'MAIN_MENU',
        context: {
          workId: null,
        },
        user: null,
        isRegistered: false,
        messages: []
      };
    }

    // Process the user input
    const response = handleChatbotLogic(message, session);
    
    // Update the session in store
    sessionStore.set(sid, session);

    return NextResponse.json({
      response,
      sessionId: sid,
      currentMenu: session.currentMenu,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
