import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const BUCKET = 'trip-files';

export type Trip = {
  id: string; name: string; destination: string | null; dest_lat: number | null; dest_lon: number | null;
  start_date: string | null; end_date: string | null; currency: string; cover_color: string;
  simplify_debts: boolean; invite_code: string; calendar_token: string; created_by: string | null; created_at: string;
  budget?: number | null;
};
export type ListName = 'bagagli' | 'cose';
export type ListItem = {
  id: string; trip_id: string; list: ListName; text: string; done: boolean;
  member_id: string | null; created_by: string | null; created_at: string;
};
export type Member = {
  id: string; trip_id: string; user_id: string | null; display_name: string;
  role: 'organizer' | 'member' | 'guest'; color: string; created_at: string; avatar_url?: string | null;
};
export type DocCategory = 'voli' | 'alloggi' | 'trasporti' | 'attivita' | 'assicurazione' | 'personali' | 'altro';
export type TripDocument = {
  id: string; trip_id: string; category: DocCategory; title: string; starts_at: string | null; ends_at: string | null;
  ref_code: string | null; address: string | null; notes: string | null; visibility: 'group' | 'private';
  file_path: string | null; file_name: string | null; mime_type: string | null; size_bytes: number | null;
  uploaded_by: string | null; created_at: string;
};
export type Assignee = { document_id: string; member_id: string };
export type ExpenseCategory = 'cibo' | 'alloggio' | 'trasporti' | 'attivita' | 'spesa' | 'altro';
export type Expense = {
  id: string; trip_id: string; title: string; amount: number; currency: string; rate: number; amount_base: number;
  paid_by: string; category: ExpenseCategory; spent_on: string; split_mode: 'equal' | 'amounts' | 'shares';
  receipt_path: string | null; client_id: string | null; created_by: string | null; created_at: string;
};
export type Share = { expense_id: string; member_id: string; amount_base: number; weight: number | null };
export type Settlement = { id: string; trip_id: string; from_member: string; to_member: string; amount_base: number; created_at: string };
export type Activity = { id: number; trip_id: string; member_id: string | null; kind: string; text: string; created_at: string };
export type Profile = { id: string; display_name: string; paypal_me: string | null; iban: string | null; locale: string; avatar_url?: string | null };
export const AVATAR_BUCKET = 'avatars';

export type TripBundle = {
  trip: Trip; members: Member[]; documents: TripDocument[]; assignees: Assignee[];
  expenses: Expense[]; shares: Share[]; settlements: Settlement[]; activity: Activity[]; profiles: Profile[];
  lists: ListItem[];
  me: Member | null; fetchedAt: number;
};
