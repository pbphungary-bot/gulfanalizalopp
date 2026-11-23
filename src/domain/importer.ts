import { unzipSync } from 'fflate';
import { DISTANCE_CLUBS } from './clubs';
import { M_PER_YD } from './units';

/* ------------------------------------------------------------------ */
/* 1. Reading files into a grid of text cells                          */
/* ------------------------------------------------------------------ */

/** Split delimited text into rows. Handles quotes, BOM and ; , or tab separators. */
export function parseDelimited(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLines = text.split(/\r?\n/).slice(0, 12);
  const count = (d: string) => firstLines.reduce((a, l) => a + (l.split(d).length - 1), 0);
  const delim = ([',', ';', '\t'] as const).reduce((best, d) => (count(d) > count(best) ? d : best), ',' as ',' | ';' | '\t');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const utf8 = (u: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  try { return decodeURIComponent(escape(s)); } catch { return s; }
};

const unxml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

/** Column letters (A, B, ... AA) to a zero-based index. */
function colIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export interface Sheet {
  name: string;
  rows: string[][];
}

function parseSheetXml(sheet: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const body = cm[2] ?? '';
      let value = '';
      if (type === 's') value = shared[Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1])] ?? '';
      else if (type === 'inlineStr') value = unxml([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
      else value = unxml(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
      const idx = ref ? colIndex(ref) : cells.length;
      while (cells.length < idx) cells.push('');
      cells[idx] = value.trim();
    }
    rows.push(cells);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Read every worksheet of an .xlsx file, in workbook order, skipping empty ones. */
export function parseXlsxSheets(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes);
  const read = (name: string): string | null => (files[name] ? utf8(files[name]) : null);

  const shared: string[] = [];
  const sst = read('xl/sharedStrings.xml');
  if (sst) {
    for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const parts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unxml(t[1]));
      shared.push(parts.join(''));
    }
  }

  const targets: { name: string; path: string }[] = [];
  const wb = read('xl/workbook.xml');
  const rels = read('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const relMap = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = m[0].match(/\bId="([^"]+)"/)?.[1];
      const t = m[0].match(/\bTarget="([^"]+)"/)?.[1];
      if (id && t) relMap.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t}`);
    }
    for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
      const name = unxml(m[0].match(/\bname="([^"]*)"/)?.[1] ?? '');
      const rid = m[0].match(/\br:id="([^"]+)"/)?.[1];
      const path = rid ? relMap.get(rid) : undefined;
      if (path) targets.push({ name, path });
    }
  }
  if (!targets.length) targets.push({ name: 'Sheet1', path: 'xl/worksheets/sheet1.xml' });

  const sheets: Sheet[] = [];
  for (const t of targets) {
    const xml = read(t.path);
    if (!xml) continue;
    const rows = parseSheetXml(xml, shared);
    if (rows.length) sheets.push({ name: t.name, rows });
  }
  if (!sheets.length) throw new Error('Could not find any data in this Excel file.');
  return sheets;
}

/**
 * Choose the sheet most likely to hold shot data: one with club and carry columns wins,
 * and among those the one with the most rows (an "All shots" sheet beats single sessions).
 */
export function pickBestSheet(sheets: Sheet[]): number {
  let best = 0;
  let bestScore = -1;
  sheets.forEach((s, i) => {
    const t = toTable(s.rows);
    const m = detectMapping(t.headers);
    const score = (m.club !== undefined && m.carry !== undefined ? 1_000_000 : 0) + scoreHeader(t.headers) * 1000 + t.rows.length;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Rows of the best sheet in an .xlsx file. Use parseXlsxSheets to let the user choose a different one. */
export function parseXlsx(bytes: Uint8Array): string[][] {
  const sheets = parseXlsxSheets(bytes);
  return sheets[pickBestSheet(sheets)].rows;
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/* ------------------------------------------------------------------ */
/* 2. Understanding the columns                                        */
/* ------------------------------------------------------------------ */

export type Unit = 'yards' | 'meters';
export type Field = 'club' | 'carry' | 'total' | 'clubSpeed' | 'ballSpeed' | 'session';
export type Mapping = Partial<Record<Field, number>>;

const norm = (h: string) =>
  h.toLowerCase().replace(/[\(\[][^\)\]]*[\)\]]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

const SYNONYMS: Record<Field, string[]> = {
  club: ['club', 'club type', 'club name', 'club used', 'clubtype'],
  carry: ['carry', 'carry distance', 'carry dist', 'carry length', 'carry yards', 'carry yds', 'carry meters'],
  total: ['total', 'total distance', 'total dist', 'total length', 'distance', 'total yards', 'total yds'],
  clubSpeed: ['club speed', 'club head speed', 'clubhead speed', 'club spd', 'chs'],
  ballSpeed: ['ball speed', 'ball spd', 'bs'],
  session: ['session', 'session name', 'session id', 'group'],
};

function scoreHeader(cells: string[]): number {
  const names = cells.map(norm);
  let score = 0;
  (Object.keys(SYNONYMS) as Field[]).forEach((f) => {
    if (names.some((n) => SYNONYMS[f].includes(n))) score += f === 'club' || f === 'carry' ? 3 : 1;
  });
  return score;
}

export interface Table {
  /** Raw header texts keep their unit hints, e.g. "Carry (yds)" */
  headers: string[];
  /** A units row found under the headers (e.g. "yds", "mph"), if the file has one */
  units?: string[];
  rows: string[][];
}

/** Find the header row (exports often have title lines above it) and skip a units row below it. */
export function toTable(grid: string[][]): Table {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const s = scoreHeader(grid[i]);
    if (s > bestScore) { bestScore = s; best = i; }
  }
  const headers = grid[best] ?? [];
  let start = best + 1;
  let units: string[] | undefined;
  const next = grid[start];
  // A units row looks like: "", "yds", "mph", "deg": short text, no real numbers.
  if (next && next.filter((c) => c !== '').length >= 2 && next.every((c) => c === '' || (Number.isNaN(parseNumber(c)) && c.length <= 14))) {
    units = next;
    start++;
  }
  return { headers, units, rows: grid.slice(start) };
}

export function detectMapping(headers: string[]): Mapping {
  const names = headers.map(norm);
  const out: Mapping = {};
  (Object.keys(SYNONYMS) as Field[]).forEach((f) => {
    const idx = names.findIndex((n) => SYNONYMS[f].includes(n));
    if (idx >= 0) out[f] = idx;
  });
  // "Distance" alone is ambiguous when a carry column exists; keep it only as the total.
  return out;
}

export function detectUnit(headers: string[], mapping: Mapping, units?: string[]): Unit | null {
  const hints = [mapping.carry, mapping.total].filter((i): i is number => i !== undefined)
    .map((i) => `${headers[i] ?? ''} ${units?.[i] ?? ''}`.toLowerCase());
  if (hints.some((h) => /\b(m|meter|meters|metre|metres)\b/.test(h.replace(/[()\[\]]/g, ' ')))) return 'meters';
  if (hints.some((h) => /\b(yd|yds|yard|yards)\b/.test(h.replace(/[()\[\]]/g, ' ')))) return 'yards';
  return null;
}

/** Parse numbers such as "152.3", "152,3", "152 yds". Returns NaN if there is no number. */
export function parseNumber(s: string): number {
  const t = s.replace(/\s/g, '').replace(/[^0-9.,\-]/g, '');
  if (!t || !/[0-9]/.test(t)) return NaN;
  const normalized = t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, '');
  return parseFloat(normalized);
}

/* ------------------------------------------------------------------ */
/* 3. Matching club names                                              */
/* ------------------------------------------------------------------ */

/** Map the many ways monitors name clubs onto this app's club list. Returns null for unknown or putter. */
export function normalizeClub(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!s || s.includes('putter')) return null;
  if (/^(driver|dr|1 wood|1w|wood 1)$/.test(s)) return 'Driver';
  if (/^(3 wood|3w|wood 3|3 fairway wood)$/.test(s)) return '3W';
  if (/^(5 wood|5w|wood 5|5 fairway wood)$/.test(s)) return '5W';
  if (/(hybrid|rescue)/.test(s) || /^(h ?\d|\d ?h)$/.test(s)) return 'Hybrid';
  const iron = s.match(/^(?:([4-9]) ?(?:i|iron)|iron ?([4-9]))$/);
  if (iron) return `${iron[1] ?? iron[2]}i`;
  if (/^(pw|p wedge|pitching wedge|pitching)$/.test(s)) return 'PW';
  if (/^(gw|aw|gap wedge|approach wedge|a wedge|g wedge)$/.test(s)) return 'GW';
  if (/^(sw|s wedge|sand wedge|sand)$/.test(s)) return 'SW';
  if (/^(lw|l wedge|lob wedge|lob)$/.test(s)) return 'LW';
  return DISTANCE_CLUBS.includes(raw.trim()) ? raw.trim() : null;
}

/* ------------------------------------------------------------------ */
/* 4. Turning shots into per-club averages                             */
/* ------------------------------------------------------------------ */

export interface ImportShot {
  club: string;
  carry: number; // metres
  total: number | null; // metres
  clubSpeed: number | null;
  ballSpeed: number | null;
  /** True when left out of the average as an obvious mishit or bad reading */
  excluded: boolean;
}

export interface ClubAverage {
  club: string;
  /** Shots read for this club */
  shots: number;
  /** Shots used in the average after excluding mishits */
  used: number;
  carry: number;
  total: number | null;
  median: number;
}

export interface PreviewSession {
  name: string;
  /** Rows with a club and a carry in this session */
  shots: number;
  unit: Unit;
  included: boolean;
}

export interface ImportPreview {
  mapping: Mapping;
  unit: Unit;
  unitDetected: boolean;
  rowsRead: number;
  rowsUsed: number;
  shots: ImportShot[];
  clubs: ClubAverage[];
  unmatched: { name: string; count: number }[];
  /** Present only when the file has a session column with more than one session */
  sessions: PreviewSession[];
  warnings: string[];
}

export interface PreviewOptions {
  mapping?: Mapping;
  /** Unit for the whole file, or for sessions with no unit of their own */
  unit?: Unit;
  /** Unit to assume when the file does not say; defaults to yards */
  defaultUnit?: Unit;
  filterMishits?: boolean;
  /** Per-session units, for files that mix yards and meters */
  sessionUnits?: Record<string, Unit>;
  /** Sessions to leave out entirely */
  excludedSessions?: string[];
  /** Club names the app does not know, mapped to a club in the bag (e.g. a driver model name) */
  aliases?: Record<string, string>;
}

export const MISHIT_LOW = 0.75;
export const MISHIT_HIGH = 1.25;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function buildPreview(
  table: Table,
  opts: PreviewOptions = {},
): ImportPreview {
  const mapping = opts.mapping ?? detectMapping(table.headers);
  const detected = detectUnit(table.headers, mapping, table.units);
  const unit = opts.unit ?? detected ?? opts.defaultUnit ?? 'yards';
  const filter = opts.filterMishits ?? true;
  const warnings: string[] = [];
  if (mapping.club === undefined) warnings.push('No club column found. Choose which column holds the club.');
  if (mapping.carry === undefined) warnings.push('No carry column found. Choose which column holds carry distance.');
  const multiSession = mapping.session !== undefined && new Set(table.rows.map((r) => (r[mapping.session!] ?? '').trim())).size > 1;
  if (!opts.unit && !detected && !multiSession) warnings.push('The file does not say yards or meters, so yards is assumed. Change it below if needed.');

  const shots: ImportShot[] = [];
  const unmatchedCount = new Map<string, number>();
  const sessionCount = new Map<string, number>();
  const excluded = new Set(opts.excludedSessions ?? []);
  const unitFor = (session: string | null): Unit => (session && opts.sessionUnits?.[session]) || unit;
  let rowsUsed = 0;

  if (mapping.club !== undefined && mapping.carry !== undefined) {
    for (const row of table.rows) {
      const name = (row[mapping.club] ?? '').trim();
      const carry = parseNumber(row[mapping.carry] ?? '');
      if (!name || Number.isNaN(carry) || carry <= 0) continue;
      const session = mapping.session !== undefined ? ((row[mapping.session] ?? '').trim() || '(no name)') : null;
      if (session) sessionCount.set(session, (sessionCount.get(session) ?? 0) + 1);
      if (session && excluded.has(session)) continue;
      const alias = opts.aliases?.[name];
      const club = normalizeClub(name) ?? (alias && DISTANCE_CLUBS.includes(alias) ? alias : null);
      if (!club) {
        if (!/putter/i.test(name) && alias !== '') unmatchedCount.set(name, (unmatchedCount.get(name) ?? 0) + 1);
        continue;
      }
      const factor = unitFor(session) === 'yards' ? M_PER_YD : 1;
      const num = (f: Field) => {
        const i = mapping[f];
        if (i === undefined) return null;
        const v = parseNumber(row[i] ?? '');
        return Number.isNaN(v) || v <= 0 ? null : v;
      };
      const total = num('total');
      shots.push({
        club,
        carry: carry * factor,
        total: total === null ? null : total * factor,
        clubSpeed: num('clubSpeed'),
        ballSpeed: num('ballSpeed'),
        excluded: false,
      });
      rowsUsed++;
    }
  }

  const clubs: ClubAverage[] = [];
  for (const club of DISTANCE_CLUBS) {
    const own = shots.filter((s) => s.club === club);
    if (!own.length) continue;
    const med = median(own.map((s) => s.carry));
    if (filter && own.length >= 3) {
      own.forEach((s) => { s.excluded = s.carry < med * MISHIT_LOW || s.carry > med * MISHIT_HIGH; });
    }
    const kept = own.filter((s) => !s.excluded);
    const totals = kept.map((s) => s.total).filter((t): t is number => t !== null);
    clubs.push({
      club,
      shots: own.length,
      used: kept.length,
      carry: kept.reduce((a, s) => a + s.carry, 0) / kept.length,
      total: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
      median: med,
    });
  }
  const sessions: PreviewSession[] =
    sessionCount.size > 1
      ? [...sessionCount].map(([name, count]) => ({ name, shots: count, unit: unitFor(name), included: !excluded.has(name) }))
      : [];
  if (sessions.length && !detected && !opts.sessionUnits) {
    warnings.push('This file combines several sessions and does not say which units each one uses. Check the units for every session below before saving.');
  }
  if (clubs.some((c) => c.used < 5)) warnings.push('Some clubs have fewer than 5 usable shots, so their averages may move a lot.');

  return {
    mapping, unit, unitDetected: !!detected,
    rowsRead: table.rows.length, rowsUsed, shots, clubs,
    unmatched: [...unmatchedCount].map(([name, count]) => ({ name, count })),
    sessions,
    warnings,
  };
}

/** One call from raw grid to preview. */
export function previewFromGrid(grid: string[][], opts: PreviewOptions = {}): { table: Table; preview: ImportPreview } {
  const table = toTable(grid);
  return { table, preview: buildPreview(table, opts) };
}
