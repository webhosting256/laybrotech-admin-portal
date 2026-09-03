import { supabase } from './supabase';
import type { Enquiry, EnquiryStatus } from '../types/enquiry';

const enquiryFields = 'id,full_name,email,phone,company,subject,message,status,created_at,updated_at';

export async function listEnquiries() {
  const { data, error } = await supabase.from('enquiries').select(enquiryFields).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as Enquiry[];
}
export async function countNewEnquiries() {
  const { count, error } = await supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new');
  if (error) throw error;
  return count ?? 0;
}

export function notifyEnquiriesChanged() { window.dispatchEvent(new Event('enquiries-updated')); }

export async function updateEnquiryStatus(id: string, status: EnquiryStatus) {
  const { data, error } = await supabase.from('enquiries').update({ status }).eq('id', id).select(enquiryFields).single();
  if (error) throw error;
  return data as Enquiry;
}

export async function deleteEnquiry(id: string) {
  const { error } = await supabase.from('enquiries').delete().eq('id', id);
  if (error) throw error;
}
