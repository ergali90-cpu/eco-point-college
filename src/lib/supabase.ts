import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isConfigured = url.startsWith('http') && key.length > 20;

export const supabase = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export const BOTTLES_PER_KG = 20;
export const kg = (bottles: number) => Math.round((bottles / BOTTLES_PER_KG) * 10) / 10;

export type Role = 'student' | 'admin';
export type Status = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  college: string;
  group_name: string;
  student_id: string;
  role: Role;
  points: number;
  total_bottles: number;
  created_at: string;
}
export interface Submission {
  id: string;
  user_id: string;
  bottles: number;
  collected_on: string;
  photo_url: string | null;
  status: Status;
  admin_note: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'full_name' | 'group_name' | 'student_id'>;
}
export interface Reward {
  id: string;
  title_kk: string;
  title_ru: string;
  desc_kk: string;
  desc_ru: string;
  category: 'merch' | 'stationery' | 'eco' | 'certificate' | 'gift';
  cost: number;
  stock: number;
  icon: string;
  active: boolean;
}
export interface Redemption {
  id: string;
  user_id: string;
  reward_id: string;
  cost: number;
  status: Status;
  created_at: string;
  rewards?: Pick<Reward, 'title_kk' | 'title_ru' | 'icon'>;
  profiles?: Pick<Profile, 'full_name' | 'group_name'>;
}
export interface Tx {
  id: number;
  amount: number;
  kind: 'earn' | 'spend' | 'adjust';
  description: string;
  created_at: string;
}
export interface LeaderRow {
  rank: number;
  id: string;
  full_name: string;
  group_name: string;
  points: number;
}
export interface Stats {
  total_bottles: number;
  students: number;
  active_students: number;
  pending_submissions: number;
  pending_redemptions: number;
  monthly: { month: string; bottles: number }[];
  groups: { name: string; bottles: number; students: number }[];
}

/** Map a Postgres/Supabase error to an i18n key when we know it. */
export function errKey(e: any): string {
  const m: string = e?.message ?? String(e);
  const known = [
    'not_enough_points', 'out_of_stock', 'already_reviewed', 'cannot_review_own',
    'not_admin', 'reward_not_found', 'cannot_adjust_own',
  ];
  for (const k of known) if (m.includes(k)) return `err.${k}`;
  if (m.includes('submissions_no_dupes') || m.includes('duplicate key')) return 'err.duplicate';
  if (/rate limit|too many|429/i.test(m) || e?.status === 429) return 'err.rate_limit';
  if (/email not confirmed/i.test(m)) return 'err.email_not_confirmed';
  if (m.includes('Invalid login')) return 'err.login';
  if (m.includes('already registered')) return 'err.exists';
  if (m.includes('profiles_student_id_uq')) return 'err.student_id_taken';
  if (m.includes('points_check')) return 'err.not_enough_points';
  return m;
}
