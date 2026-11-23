import type { MsgParam, TFn } from '../domain/types';
import { longFromM, longUnit, shortUnit, UnitSystem } from '../domain/units';
import { en } from './en';
import { hu } from './hu';

export type Lang = 'en' | 'hu';
export const LANGS: Lang[] = ['en', 'hu'];
export const LANG_NAME: Record<Lang, string> = { en: 'English', hu: 'Magyar' };

const DICTS: Record<Lang, Record<string, string>> = { en, hu };

export function fmtNum(n: number, decimals: number | undefined, lang: Lang): string {
  const s = decimals === undefined ? String(n) : n.toFixed(decimals);
  return lang === 'hu' ? s.replace('.', ',') : s;
}

/** Build a translate function. Missing Hungarian text falls back to English, then to the key itself. */
export function makeT(lang: Lang, system: UnitSystem = 'metric'): TFn {
  const render = (v: MsgParam): string => {
    if (typeof v === 'number') return fmtNum(v, undefined, lang);
    if (typeof v === 'string') return v;
    if ('k' in v) return t(v.k, v.p);
    if ('m' in v) {
      const n = fmtNum(Math.round(longFromM(v.m, system)), undefined, lang);
      return v.unit === false ? n : `${n} ${longUnit(system)}`;
    }
    if ('unit' in v) return v.unit === 'long' ? longUnit(system) : shortUnit(system);
    return fmtNum(v.n, v.d, lang);
  };
  const t: TFn = (key, params) => {
    const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_m, name: string) => {
      const v = params[name];
      return v === undefined ? `{${name}}` : render(v);
    });
  };
  return t;
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return lang === 'hu'
    ? `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}.`
    : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}
