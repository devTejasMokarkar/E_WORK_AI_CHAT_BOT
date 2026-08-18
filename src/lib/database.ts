/**
 * Database Utility Functions for e-Work Chatbot
 */
import { supabase } from './supabase';
import type {
  EworkUser,
  Work,
  Sanction,
  MeasurementBook,
  Voucher,
  FTO,
  UtilizationCertificate,
  CompletionCertificate,
  WorkPhoto,
  AuditLog,
  AIQueryResult,
} from '@/types';

/**
 * Check if a mobile number is registered in e-Work
 */
export async function checkUserRegistration(mobileNumber: string): Promise<EworkUser | null> {
  const { data, error } = await supabase
    .from('ework_users')
    .select('*')
    .eq('mobile_number', mobileNumber)
    .single();

  if (error || !data) {
    return null;
  }

  return data as EworkUser;
}

/**
 * Get work by Work ID with authorization check
 */
export async function getWorkById(
  workId: string,
  user: EworkUser | null
): Promise<{ work: Work | null; authorized: boolean; error?: string }> {
  // First, try to find the work
  const { data: work, error: workError } = await supabase
    .from('works')
    .select('*')
    .eq('work_id', workId)
    .single();

  if (workError || !work) {
    return { work: null, authorized: false, error: 'Work ID not found' };
  }

  // If no user context, allow access (for demo purposes)
  if (!user) {
    return { work: work as Work, authorized: true };
  }

  // Check authorization based on user level
  let authorized = false;

  switch (user.user_level) {
    case 'State':
      authorized = true; // State users can view all
      break;
    case 'District':
      authorized = work.district === user.district;
      break;
    case 'Block':
      authorized = work.district === user.district && work.block === user.block;
      break;
    case 'Gram Panchayat':
      authorized =
        work.district === user.district &&
        work.block === user.block &&
        work.gram_panchayat === user.gram_panchayat;
      break;
  }

  if (!authorized) {
    return { work: null, authorized: false, error: 'You are not authorized to view this work' };
  }

  return { work: work as Work, authorized: true };
}

/**
 * Get sanctions for a work
 */
export async function getSanctions(workId: string, type?: 'Administrative' | 'Technical' | 'Financial'): Promise<Sanction[]> {
  let query = supabase
    .from('sanctions')
    .select('*')
    .eq('work_id', workId);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query.order('type');

  if (error) {
    console.error('Error fetching sanctions:', error);
    return [];
  }

  return (data as Sanction[]) ?? [];
}

/**
 * Get measurement books for a work
 */
export async function getMeasurementBooks(workId: string): Promise<MeasurementBook[]> {
  const { data, error } = await supabase
    .from('measurement_books')
    .select('*')
    .eq('work_id', workId)
    .order('mb_number');

  if (error) {
    console.error('Error fetching measurement books:', error);
    return [];
  }

  return (data as MeasurementBook[]) ?? [];
}

/**
 * Get vouchers for a work
 */
export async function getVouchers(workId: string): Promise<Voucher[]> {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('work_id', workId)
    .order('voucher_date', { ascending: false });

  if (error) {
    console.error('Error fetching vouchers:', error);
    return [];
  }

  return (data as Voucher[]) ?? [];
}

/**
 * Get FTOs for a voucher
 */
export async function getFTOs(voucherId: string): Promise<FTO[]> {
  const { data, error } = await supabase
    .from('ftos')
    .select('*')
    .eq('voucher_id', voucherId)
    .order('fto_date', { ascending: false });

  if (error) {
    console.error('Error fetching FTOs:', error);
    return [];
  }

  return (data as FTO[]) ?? [];
}

/**
 * Get all FTOs for a work (via vouchers)
 */
export async function getWorkFTOs(workId: string): Promise<FTO[]> {
  const vouchers = await getVouchers(workId);
  const voucherIds = vouchers.map((v) => v.id);

  if (voucherIds.length === 0) return [];

  const { data, error } = await supabase
    .from('ftos')
    .select('*')
    .in('voucher_id', voucherIds)
    .order('fto_date', { ascending: false });

  if (error) {
    console.error('Error fetching FTOs:', error);
    return [];
  }

  return (data as FTO[]) ?? [];
}

/**
 * Get utilization certificate for a work
 */
export async function getUtilizationCertificate(workId: string): Promise<UtilizationCertificate | null> {
  const { data, error } = await supabase
    .from('utilization_certificates')
    .select('*')
    .eq('work_id', workId)
    .single();

  if (error) {
    return null;
  }

  return data as UtilizationCertificate;
}

/**
 * Get completion certificate for a work
 */
export async function getCompletionCertificate(workId: string): Promise<CompletionCertificate | null> {
  const { data, error } = await supabase
    .from('completion_certificates')
    .select('*')
    .eq('work_id', workId)
    .single();

  if (error) {
    return null;
  }

  return data as CompletionCertificate;
}

/**
 * Get work photos for a work
 */
export async function getWorkPhotos(workId: string, limit: number = 1): Promise<WorkPhoto[]> {
  const { data, error } = await supabase
    .from('work_photos')
    .select('*')
    .eq('work_id', workId)
    .order('upload_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching work photos:', error);
    return [];
  }

  return (data as WorkPhoto[]) ?? [];
}

/**
 * Log conversation to audit table
 */
export async function logAudit(
  sessionId: string,
  mobileNumber: string | null,
  userQuery: string,
  botResponse: string,
  language: 'en' | 'hi' | 'mixed',
  intent: string | null
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    session_id: sessionId,
    user_mobile: mobileNumber,
    user_query: userQuery,
    bot_response: botResponse,
    language,
    intent,
  });

  if (error) {
    console.error('Error logging audit:', error);
  }
}

// Analytics queries for "Ask e-Work AI"

/**
 * Get work count by status for a user
 */
export async function getWorkCountByStatus(user: EworkUser, status?: string): Promise<number> {
  let query = supabase
    .from('works')
    .select('id', { count: 'exact', head: true });

  // Apply location filters based on user level
  if (user.user_level === 'District') {
    query = query.eq('district', user.district);
  } else if (user.user_level === 'Block') {
    query = query.eq('district', user.district).eq('block', user.block);
  } else if (user.user_level === 'Gram Panchayat') {
    query = query
      .eq('district', user.district)
      .eq('block', user.block)
      .eq('gram_panchayat', user.gram_panchayat);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { count } = await query;
  return count ?? 0;
}

/**
 * Get total payment for a user in current financial year
 */
export async function getTotalPayment(user: EworkUser, financialYear: string): Promise<number> {
  // Get works for the user
  let worksQuery = supabase
    .from('works')
    .select('id');

  if (user.user_level === 'District') {
    worksQuery = worksQuery.eq('district', user.district);
  } else if (user.user_level === 'Block') {
    worksQuery = worksQuery.eq('district', user.district).eq('block', user.block);
  } else if (user.user_level === 'Gram Panchayat') {
    worksQuery = worksQuery
      .eq('district', user.district)
      .eq('block', user.block)
      .eq('gram_panchayat', user.gram_panchayat);
  }

  const { data: works } = await worksQuery.eq('financial_year', financialYear);
  const workIds = works?.map((w) => w.id) ?? [];

  if (workIds.length === 0) return 0;

  // Get approved vouchers sum
  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('net_amount')
    .in('work_id', workIds)
    .eq('status', 'Approved');

  return (vouchers?.reduce((sum, v) => sum + (v.net_amount ?? 0), 0) ?? 0);
}

/**
 * Get pending FTO count for a user
 */
export async function getPendingFTOCount(user: EworkUser): Promise<number> {
  // Similar logic to get work IDs, then count pending FTOs
  let worksQuery = supabase.from('works').select('id');

  if (user.user_level === 'District') {
    worksQuery = worksQuery.eq('district', user.district);
  } else if (user.user_level === 'Block') {
    worksQuery = worksQuery.eq('district', user.district).eq('block', user.block);
  }

  const { data: works } = await worksQuery;
  const workIds = works?.map((w) => w.id) ?? [];

  if (workIds.length === 0) return 0;

  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('id')
    .in('work_id', workIds);

  const voucherIds = vouchers?.map((v) => v.id) ?? [];
  if (voucherIds.length === 0) return 0;

  const { count } = await supabase
    .from('ftos')
    .select('id', { count: 'exact', head: true })
    .in('voucher_id', voucherIds)
    .eq('payment_status', 'Pending');

  return count ?? 0;
}

/**
 * Get payment summary for a work
 */
export async function getWorkPaymentSummary(workId: string): Promise<{
  totalVoucher: number;
  successfulPayment: number;
  pendingPayment: number;
}> {
  const vouchers = await getVouchers(workId);

  const totalVoucher = vouchers.reduce((sum, v) => sum + v.net_amount, 0);
  const successfulPayment = vouchers
    .filter((v) => v.fto_status === 'Processed')
    .reduce((sum, v) => sum + v.net_amount, 0);
  const pendingPayment = vouchers
    .filter((v) => v.fto_status !== 'Processed')
    .reduce((sum, v) => sum + v.net_amount, 0);

  return { totalVoucher, successfulPayment, pendingPayment };
}