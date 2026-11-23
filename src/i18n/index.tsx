import * as Localization from 'expo-localization';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSetting, saveSetting } from '../db';
import type { Msg, MsgParam, TFn } from '../domain/types';
import { defaultSystem, longFromM, longToM, longUnit, shortFromM, shortToM, shortUnit, UnitSystem } from '../domain/units';
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

/** Follow the phone's measurement system; Hungarian phones default to metric. */
export function deviceSystem(): UnitSystem {
  try {
    const first = Localization.getLocales()[0];
    return defaultSystem(first?.measurementSystem, first?.languageCode === 'hu');
  } catch {
    return 'metric';
  }
}

/** Accepts "152", "152.5" and "152,5". Returns NaN for anything else. */
function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
}

export interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  system: UnitSystem;
  setSystem: (s: UnitSystem) => void;
  /** Unit labels: m / yd for course distances, m / ft for putts */
  unitLong: string;
  unitShort: string;
  /** A course distance given in metres, shown in the current unit, e.g. "152 m" or "166 yd" */
  len: (m: number) => string;
  /** The number only, in the current unit */
  lenNum: (m: number) => number;
  /** A short (green) distance in metres, e.g. "3,5 m" or "11 ft" */
  short: (m: number) => string;
  /** Typed text in the current unit to metres. NaN if it is not a number */
  parseLen: (text: string) => number;
  parseShort: (text: string) => number;
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
  const [system, setSystemState] = useState<UnitSystem>(deviceSystem());

  useEffect(() => {
    getSetting<Lang>('language')
      .then((l) => l && LANGS.includes(l) && setLangState(l))
      .catch(() => {});
    getSetting<UnitSystem>('units')
      .then((u) => (u === 'metric' || u === 'imperial') && setSystemState(u))
      .catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => {
    const t = makeT(lang, system);
    return {
      lang,
      setLang: (l) => {
        setLangState(l);
        saveSetting('language', l).catch(() => {});
      },
      system,
      setSystem: (u) => {
        setSystemState(u);
        saveSetting('units', u).catch(() => {});
      },
      unitLong: longUnit(system),
      unitShort: shortUnit(system),
      len: (m) => `${fmtNum(Math.round(longFromM(m, system)), undefined, lang)} ${longUnit(system)}`,
      lenNum: (m) => longFromM(m, system),
      short: (m) => {
        const v = shortFromM(m, system);
        return `${fmtNum(system === 'metric' ? Math.round(v * 10) / 10 : Math.round(v), undefined, lang)} ${shortUnit(system)}`;
      },
      parseLen: (text) => longToM(parseNumber(text), system),
      parseShort: (text) => shortToM(parseNumber(text), system),
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
  }, [lang, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
