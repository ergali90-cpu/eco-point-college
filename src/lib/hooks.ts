import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * Runs `load` on screen focus, and again whenever any of `tables` changes (Supabase Realtime).
 * Returns [refreshing, reload].
 */
export function useLiveData(load: () => Promise<void>, tables: string[], key = 'live') {
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    setRefreshing(true);
    try { await loadRef.current(); } finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadRef.current(); }, []));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel(`${key}-${Math.random().toString(36).slice(2)}`);
    tables.forEach((table) =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadRef.current(), 300); // debounce bursts
      }));
    ch.subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [tables.join(','), key]);

  return [refreshing, reload] as const;
}

export function fmtDate(iso: string, locale: string, withTime = false) {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  try {
    return d.toLocaleDateString(locale, withTime
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d.toISOString().slice(0, 10); }
}

export function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function uuid() {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID() as string;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0, bits = 0, j = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[j++] = (buf >> bits) & 0xff; }
  }
  return out.slice(0, j);
}
