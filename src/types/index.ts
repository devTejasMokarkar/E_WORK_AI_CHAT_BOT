/**
 * e-Work Chatbot Type Definitions
 */

// User Types
export interface EworkUser {
  id: string;
  mobile_number: string;
  name: string;
  sso_id: string;
  role: UserRole;
  user_level: UserLevel;
  district: string;
  block: string;
  gram_panchayat: string;
  department: string;
  agency: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'District User' | 'Block User' | 'Gram Panchayat User' | 'State User' | 'Admin';
export type UserLevel = 'State' | 'District' | 'Block' | 'Gram Panchayat';
export type UserStatus = 'Active' | 'Inactive' | 'Pending';

// Work Types
export interface Work {
  id: string;
  work_id: string;
  work_name: string;
  scheme_name: string;
  financial_year: string;
  district: string;
  block: string;
  gram_panchayat: string;
  status: WorkStatus;
  sanctioned_amount: number;
  physical_progress: number;
  created_at: string;
  updated_at: string;
}

export type WorkStatus = 
  | 'Proposed'
  | 'Administrative Sanction Pending'
  | 'Technical Sanction Pending'
  | 'Financial Sanction Pending'
  | 'Work in Progress'
  | 'Completed'
  | 'Terminated';

// Sanction Types
export interface Sanction {
  id: string;
  work_id: string;
  type: 'Administrative' | 'Technical' | 'Financial';
  sanction_number: string;
  sanction_date: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

// Measurement Book Types
export interface MeasurementBook {
  id: string;
  work_id: string;
  mb_number: number;
  mb_type: 'Running MB' | 'Final MB';
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

// Voucher Types
export interface Voucher {
  id: string;
  work_id: string;
  voucher_number: string;
  voucher_date: string;
  gross_amount: number;
  net_amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  fto_status: 'Not Generated' | 'Generated' | 'Processed';
  created_at: string;
}

// FTO Types
export interface FTO {
  id: string;
  voucher_id: string;
  fto_number: string;
  fto_date: string;
  amount: number;
  ifms_status: 'Pending' | 'Processed' | 'Failed';
  payment_status: 'Pending' | 'Successful' | 'Failed';
  utr_number: string | null;
  payment_date: string | null;
  created_at: string;
}

// Utilization Certificate Types
export interface UtilizationCertificate {
  id: string;
  work_id: string;
  uc_number: string;
  uc_date: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

// Completion Certificate Types
export interface CompletionCertificate {
  id: string;
  work_id: string;
  cc_number: string;
  cc_date: string;
  completion_amount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

// Work Photo Types
export interface WorkPhoto {
  id: string;
  work_id: string;
  photo_url: string;
  work_stage: string;
  physical_progress: number;
  upload_date: string;
  created_at: string;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  session_id: string;
  user_mobile: string | null;
  user_query: string;
  bot_response: string;
  language: 'en' | 'hi' | 'mixed';
  intent: string | null;
  created_at: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  mobileNumber: string | null;
  user: EworkUser | null;
  isRegistered: boolean;
  messages: ChatMessage[];
  currentMenu: MenuState;
  context: {
    workId?: string;
    selectedModule?: string;
    previousMenu?: string;
  };
}

export type MenuState = 
  | 'MAIN_MENU'
  | 'ASK_CHATBOT'
  | 'EWORK_INFO'
  | 'WORK_STATUS'
  | 'WORK_DETAILS'
  | 'ASK_AI'
  | 'ADMIN_SANCTION'
  | 'TECHNICAL_SANCTION'
  | 'FINANCIAL_SANCTION'
  | 'ESTIMATE'
  | 'WORK_PROGRESS'
  | 'WORK_PHOTOS'
  | 'MEASUREMENT_BOOK'
  | 'VOUCHER_DETAILS'
  | 'FTO_DETAILS'
  | 'PAYMENT_STATUS'
  | 'UTILIZATION_CERTIFICATE'
  | 'COMPLETION_CERTIFICATE'
  | 'AWAITING_WORK_ID'
  | 'AWAITING_QUESTION';

// RAG Types
export interface RAGDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    category: string;
  };
}

export interface RAGResult {
  content: string;
  similarity: number;
  source: string;
}

// AI Query Types
export interface AIQueryResult {
  type: 'summary' | 'count' | 'payment' | 'work_details' | 'list';
  data: Record<string, unknown>;
  formatted_response: string;
}