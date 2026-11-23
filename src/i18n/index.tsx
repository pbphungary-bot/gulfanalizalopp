import * as Localization from 'expo-localization';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSetting, saveSetting } from '../db';
import type { Msg, MsgParam, TFn } from '../domain/types';
import { fmtNum, formatDate, Lang, LANGS, makeT, pad } from './core';

export { LANG_NAME, LANGS } from './core';
export type { Lang } from './core';

/** Follow the phone's language for first launch: Hungarian if the phone is Hungarian, English otherwise. */
export function deviceLang(): Lang {
  try {
    return Localization.getLocales()[0]?.languageCode === 'hu' ? 'hu' : 'en';
  } catch {
    return 'en';
  }
}

export interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
  /** Translate a stored message (or legacy plain text) */
  tm: (m: Msg | string) => string;
  /** Plural form: looks up `<key>.one` for 1 and `<key>.other` otherwise; {n} is filled in */
  tn: (key: string, n: number, params?: Record<string, MsgParam>) => string;
  num: (n: number, decimals?: number) => string;
  date: (iso: string) => string;
  minutes: (total: number) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang());

  useEffect(() => {
    getSetting<Lang>('language')
      .then((l) => l && LANGS.includes(l) && setLangState(l))
      .catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => {
    const t = makeT(lang);
    return {
      lang,
      setLang: (l) => {
        setLangState(l);
        saveSetting('language', l).catch(() => {});
      },
      t,
      tm: (m) => (typeof m === 'string' ? m : t(m.k, m.p)),
      tn: (key, n, params) => t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...params }),
      num: (n, decimals) => fmtNum(n, decimals, lang),
      date: (iso) => formatDate(iso, lang),
      minutes: (total) => {
        const h = Math.floor(total / 60);
        const m = total % 60;
        return h ? t('time.hm', { h, m: pad(m) }) : t('time.m', { m });
      },
    };
  }, [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
