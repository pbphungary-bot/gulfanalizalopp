// File import: CSV and Excel (.xlsx) read on the device, no server and no library.
// Recognises two kinds of table: launch monitor shots, and past rounds.
import { CLUBS } from './store.js';

// ---------- Reading files into rows ----------
export async function readTable(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return readXlsx(await file.arrayBuffer());
  if (name.endsWith('.xls')) throw new Error('Old .xls files are not supported. Save it as .xlsx or CSV and try again.');
  return parseCSV(await file.text());
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delim = [';', '\t', ','].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return [{ name: 'CSV', rows: rows.filter((r) => r.some((v) => String(v).trim() !== '')) }];
}

// Minimal .xlsx reader: unzip with the browser's DecompressionStream, parse the sheet XML.
async function readXlsx(buf) {
  const files = await unzip(buf);
  const xml = (p) => (files[p] ? new DOMParser().parseFromString(files[p], 'application/xml') : null);
  const shared = [];
  const ss = xml('xl/sharedStrings.xml');
  if (ss) for (const si of ss.getElementsByTagName('si')) shared.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent).join(''));
  const wb = xml('xl/workbook.xml');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const relMap = {};
  if (rels) for (const r of rels.getElementsByTagName('Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target');
  const sheets = [];
  for (const s of wb.getElementsByTagName('sheet')) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = relMap[rid] || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const doc = xml(target);
    if (!doc) continue;
    const rows = [];
    for (const r of doc.getElementsByTagName('row')) {
      const out = [];
      for (const c of r.getElementsByTagName('c')) {
        const ref = c.getAttribute('r') || '';
        const col = colIndex(ref.replace(/\d+/g, '')) ?? out.length;
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0];
        let val = '';
        if (t === 's') val = shared[Number(v?.textContent)] ?? '';
        else if (t === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent).join('');
        else if (t === 'b') val = v?.textContent === '1';
        else if (v) { const n = Number(v.textContent); val = isNaN(n) ? v.textContent : n; }
        out[col] = val;
      }
      for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = '';
      if (out.some((x) => String(x).trim() !== '')) rows.push(out);
    }
    sheets.push({ name: s.getAttribute('name'), rows });
  }
  return sheets;
}

function colIndex(letters) {
  if (!letters) return null;
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function unzip(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This file does not look like an Excel workbook.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    p += 46 + nlen + xlen + clen;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = new Uint8Array(buf, start, csize);
    if (method === 0) out[name] = dec.decode(data);
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open Excel files. Update it, or save the file as CSV.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out[name] = await new Response(stream).text();
    }
  }
  return out;
}

// ---------- Header matching ----------
const norm = (h) => String(h).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9#]/g, '');
const unitOf = (h) => { const m = String(h).toLowerCase().match(/\(([^)]+)\)/); return m ? m[1].trim() : ''; };

const LAUNCH_FIELDS = {
  group: ['group', 'set', 'color', 'colour'],
  club: ['club', 'clubtype', 'clubname'],
  date: ['date', 'sessiondate'],
  carry: ['carry', 'carrydistance'],
  total: ['total', 'totaldistance', 'distance'],
  clubSpeed: ['clubspeed', 'clubspd', 'clubheadspeed'],
  ballSpeed: ['ballspeed', 'ballspd'],
  path: ['path', 'clubpath'],
  face: ['face', 'faceangle', 'facetopath'],
  smash: ['smash', 'smashfactor'],
  launch: ['launch', 'launchangle', 'vla', 'verticallaunch'],
  backspin: ['backspin', 'spin', 'spinrate', 'totalspin'],
  sidespin: ['sidespin', 'spinaxis'],
  apex: ['apex', 'height', 'peakheight', 'maxheight'],
  toTarget: ['totarget', 'offline', 'lateral', 'deviation', 'side'],
  source: ['source', 'sourceimage', 'sourceimages', 'sourceimages'],
  note: ['reviewnote', 'note', 'notes', 'comment']
};

const ROUND_FIELDS = {
  date: ['date', 'playedon', 'datum'],
  course: ['course', 'coursename', 'club', 'golfclub', 'palya'],
  holes: ['holes', 'holecount', 'holesplayed'],
  score: ['score', 'gross', 'grossscore', 'strokes', 'total', 'totalscore'],
  par: ['par', 'coursepar'],
  putts: ['putts', 'totalputts'],
  competition: ['competition', 'comp', 'tournament', 'verseny', 'qualifying']
};

function mapHeaders(header, fields) {
  const map = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(fields)) if (map[key] == null && names.includes(n)) map[key] = i;
  });
  return map;
}

function findHeaderRow(rows, fields, required) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const m = mapHeaders(rows[i], fields);
    if (required.every((k) => m[k] != null)) return { index: i, map: m };
  }
  return null;
}

const num = (v) => {
  if (v === '' || v == null || v === '-' || v === '–') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

// ---------- Launch monitor ----------
const toMeters = (v, unit) => (v == null ? null : /yd|yard/.test(unit) ? v * 0.9144 : /ft|feet/.test(unit) ? v * 0.3048 : v);
const toMph = (v, unit) => (v == null ? null : /km/.test(unit) ? v / 1.609344 : /m\/s|mps/.test(unit) ? v * 2.236936 : v);
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

export function parseLaunch(sheets) {
  for (const sheet of sheets) {
    const h = findHeaderRow(sheet.rows, LAUNCH_FIELDS, ['carry']);
    if (!h || (h.map.ballSpeed == null && h.map.clubSpeed == null && h.map.backspin == null)) continue;
    const header = sheet.rows[h.index];
    const unit = (k) => (h.map[k] != null ? unitOf(header[h.map[k]]) : '');
    const shots = [];
    for (const r of sheet.rows.slice(h.index + 1)) {
      const g = (k) => (h.map[k] != null ? r[h.map[k]] : null);
      const label = String(g('group') ?? '').trim();
      if (/^avg|^average|^mean|^átlag/i.test(label) || /^avg|^average/i.test(String(r[0] ?? '').trim())) continue;
      const carry = num(g('carry'));
      if (carry == null) continue;
      // A value written with a sign or a direction letter (L/R, D/F) counts as signed.
      const dir = (k, neg) => {
        const raw = g(k); if (raw == null || raw === '') return { v: null, signed: false };
        if (typeof raw === 'number') return { v: raw, signed: raw < 0 };
        const s = String(raw).trim();
        const n = num(s.replace(/[A-Za-z]/g, ''));
        if (n == null) return { v: null, signed: false };
        if (neg.test(s)) return { v: -Math.abs(n), signed: true };
        if (/[A-Za-z]/.test(s) || s.startsWith('+')) return { v: Math.abs(n), signed: true };
        return { v: n, signed: n < 0 };
      };
      const path = dir('path', /^-|out|oi/i), face = dir('face', /^-|cl|^c/i), side = dir('sidespin', /^-|d|l/i), tt = dir('toTarget', /^-|l/i);
      shots.push({
        group: label || 'All shots',
        club: matchClub(g('club')),
        date: g('date'),
        carry: round1(toMeters(carry, unit('carry'))),
        total: round1(toMeters(num(g('total')), unit('total'))),
        clubSpeed: round1(toMph(num(g('clubSpeed')), unit('clubSpeed'))),
        ballSpeed: round1(toMph(num(g('ballSpeed')), unit('ballSpeed'))),
        path: path.v, face: face.v,
        smash: num(g('smash')),
        launch: num(g('launch')),
        backspin: num(g('backspin')),
        sidespin: side.v,
        apex: round1(toMeters(num(g('apex')), unit('apex'))),
        toTarget: round1(toMeters(tt.v, unit('toTarget'))),
        signed: path.signed || face.signed || side.signed,
        note: [g('note'), g('source')].filter((x) => x && String(x).trim()).join(' · ') || null
      });
    }
    if (shots.length) return { sheet: sheet.name, shots, columns: Object.keys(h.map) };
  }
  return null;
}

export function matchClub(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase().replace(/\s+/g, '');
  const alias = { dr: 'Driver', driver: 'Driver', '1w': 'Driver', '3w': '3W', '3wood': '3W', '5w': '5W', '5wood': '5W', hy: 'Hybrid', hybrid: 'Hybrid', pw: 'PW', gw: 'GW', aw: 'GW', sw: 'SW', lw: 'LW', putter: 'Putter', pt: 'Putter' };
  if (alias[s]) return alias[s];
  const iron = s.match(/^([3-9])(i|iron)$/);
  if (iron) return iron[1] === '3' ? '4i' : iron[1] + 'i';
  return CLUBS.find((c) => c.toLowerCase() === s) || null;
}

// Groups the parsed shots, with a club guess from the group name when it names a club.
export function groupLaunch(shots) {
  const groups = [];
  for (const s of shots) {
    let g = groups.find((x) => x.name === s.group);
    if (!g) { g = { name: s.group, shots: [], club: s.club || matchClub(s.group) }; groups.push(g); }
    g.shots.push(s);
  }
  for (const g of groups) {
    const c = g.shots.map((s) => s.carry).filter((v) => v != null);
    const cs = g.shots.map((s) => s.clubSpeed).filter((v) => v != null);
    g.avgCarry = c.length ? c.reduce((a, b) => a + b, 0) / c.length : null;
    g.avgClubSpeed = cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : null;
  }
  return groups;
}

// ---------- Past rounds ----------
export function parseRounds(sheets) {
  for (const sheet of sheets) {
    const h = findHeaderRow(sheet.rows, ROUND_FIELDS, ['date', 'course']);
    if (!h) continue;
    const header = sheet.rows[h.index];
    const holeCols = {}, puttCols = {};
    header.forEach((x, i) => {
      const n = norm(x);
      let m = n.match(/^(?:h|hole|lyuk)?(\d{1,2})$/); if (m && +m[1] >= 1 && +m[1] <= 18) holeCols[+m[1]] = i;
      m = n.match(/^(?:p|putts?)(\d{1,2})$/); if (m && +m[1] >= 1 && +m[1] <= 18) puttCols[+m[1]] = i;
    });
    const hasHoles = Object.keys(holeCols).length >= 9;
    if (h.map.score == null && !hasHoles) continue;
    const rounds = [], problems = [];
    sheet.rows.slice(h.index + 1).forEach((r, idx) => {
      const g = (k) => (h.map[k] != null ? r[h.map[k]] : null);
      const date = toISODate(g('date'));
      const course = String(g('course') ?? '').trim();
      const line = h.index + idx + 2;
      if (!date || !course) { problems.push(`Row ${line}: date or course missing`); return; }
      const comp = String(g('competition') ?? '').trim().toLowerCase();
      const competition = ['y', 'yes', 'true', '1', 'x', 'igen', 'i'].includes(comp) || g('competition') === true;
      const holeScores = Object.entries(holeCols).map(([n, i]) => ({ n: +n, score: num(r[i]), putts: puttCols[n] != null ? num(r[puttCols[n]]) : null })).filter((x) => x.score != null);
      if (holeScores.length === 9 || holeScores.length === 18) {
        rounds.push({ courseName: course, date, holeCount: holeScores.length, detail: 'holes', holes: holeScores.map((x) => ({ ...x, par: null })), competition, source: 'file' });
        return;
      }
      const score = num(g('score'));
      if (score == null) { problems.push(`Row ${line}: no score`); return; }
      let holes = num(g('holes'));
      if (holes !== 9 && holes !== 18) holes = score < 65 ? 9 : 18;
      const par = num(g('par'));
      rounds.push({ courseName: course, date, holeCount: holes, detail: 'total', totalScore: score, parTotal: par ?? (holes === 9 ? 36 : 72), parGuessed: par == null, totalPutts: num(g('putts')), competition, source: 'file' });
    });
    if (rounds.length || problems.length) return { sheet: sheet.name, rounds, problems };
  }
  return null;
}

function toISODate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {      // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})/);           // 2025-06-07, 2025. 06. 07.
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);                       // 07/06/2025 (day first)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export const ROUNDS_TEMPLATE = 'Date,Course,Holes,Score,Par,Putts,Competition\n2025-06-07,Example Golf Club,18,88,72,34,yes\n2025-06-14,Example Golf Club,9,44,36,,no\n';
