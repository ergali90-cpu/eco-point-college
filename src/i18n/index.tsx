import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Lang, TKey, translations } from './translations';

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey | string) => string;
  /** pick the localized field of a record, e.g. tl(reward, 'title') -> title_kk | title_ru */
  tl: <T extends Record<string, any>>(obj: T, base: string) => string;
  locale: string;
}

const Ctx = createContext<I18n | null>(null);
const KEY = 'eco.lang';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('kk');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'kk' || v === 'ru') setLangState(v); }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => ({
    lang,
    setLang,
    locale: lang === 'kk' ? 'kk-KZ' : 'ru-RU',
    t: (key) => (translations[lang] as Record<string, string>)[key] ?? key,
    tl: (obj, base) => obj?.[`${base}_${lang}`] ?? obj?.[`${base}_ru`] ?? '',
  }), [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside provider');
  return c;
}
