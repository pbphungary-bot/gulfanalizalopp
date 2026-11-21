// One shared, versioned document for every module of the app.
// Stored in localStorage on the device; exportable as a JSON backup.

const KEY = 'golfcoach.v1';
export const SCHEMA_VERSION = 1;

export const LIES = ['tee', 'fairway', 'rough', 'sand', 'recovery', 'green', 'holed'];
export const CLUBS = ['Driver', '3W', '5W', 'Hybrid', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW', 'Putter'];

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function empty() {
  return {
    schemaVersion: SCHEMA_VERSION,
    player: null,          // { id, name, handicap, targetHandicap, homeCourse, practiceMinutesPerWeek, preferredPlayDay, createdAt, updatedAt }
    goals: [],             // { id, kind: 'handicap'|'custom', title, target, byDate, status, createdAt }
    courses: [],           // { id, name, holes: [{ n, par, yards }], updatedAt }
    rounds: [],            // { id, courseId, courseName, date, holes: [{ n, par, yards }], status: 'in_progress'|'complete', createdAt, completedAt }
    shots: [],             // { id, roundId, hole, seq, club, startLie, startDist, endLie, endDist, penalty, createdAt }
    practiceSessions: [],  // milestone 3
    plans: []              // milestone 4
  };
}

function migrate(doc) {
  // Future schema versions upgrade here, step by step.
  const base = empty();
  for (const k of Object.keys(base)) if (doc[k] === undefined) doc[k] = base[k];
  doc.schemaVersion = SCHEMA_VERSION;
  return doc;
}

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : empty();
  } catch (e) {
    console.error('Could not read saved data', e);
    return empty();
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function data() { return db; }

// Ask the browser not to evict our storage (best effort, mostly matters on mobile).
export function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// ---- Player and goals ----
export function savePlayer(fields) {
  const now = new Date().toISOString();
  db.player = { ...(db.player || { id: uid(), createdAt: now }), ...fields, updatedAt: now };
  // Keep the handicap goal in step with the profile target.
  let g = db.goals.find((x) => x.kind === 'handicap' && x.status === 'active');
  if (fields.targetHandicap != null && !isNaN(fields.targetHandicap)) {
    if (!g) { g = { id: uid(), kind: 'handicap', status: 'active', createdAt: now }; db.goals.push(g); }
    g.title = 'Reach a ' + fields.targetHandicap.toFixed(1) + ' handicap';
    g.target = fields.targetHandicap;
  }
  persist();
}

// ---- Courses ----
export function findCourse(name) {
  const n = name.trim().toLowerCase();
  return db.courses.find((c) => c.name.trim().toLowerCase() === n);
}

function rememberCourse(round) {
  let c = db.courses.find((x) => x.id === round.courseId) || findCourse(round.courseName);
  const holes = round.holes.map((h) => ({ ...h }));
  if (!c) { c = { id: uid(), name: round.courseName }; db.courses.push(c); }
  // Keep the longest layout seen (an 18-hole round updates a 9-hole one).
  if (!c.holes || holes.length >= c.holes.length) c.holes = holes;
  c.updatedAt = new Date().toISOString();
  round.courseId = c.id;
}

// ---- Rounds ----
export function activeRound() {
  return db.rounds.find((r) => r.status === 'in_progress') || null;
}

export function startRound({ courseName, date, holeCount }) {
  const course = findCourse(courseName);
  const holes = [];
  for (let i = 1; i <= holeCount; i++) {
    const known = course && course.holes && course.holes.find((h) => h.n === i);
    holes.push(known ? { ...known } : { n: i, par: 4, yards: null });
  }
  const r = {
    id: uid(), courseId: course ? course.id : null, courseName: courseName.trim(), date,
    holes, status: 'in_progress', createdAt: new Date().toISOString(), completedAt: null
  };
  db.rounds.push(r);
  rememberCourse(r);
  persist();
  return r;
}

export function updateHole(roundId, n, fields) {
  const r = db.rounds.find((x) => x.id === roundId);
  const h = r.holes.find((x) => x.n === n);
  Object.assign(h, fields);
  // If the tee shot exists, keep its start distance in step with the hole length.
  if (fields.yards != null) {
    const tee = db.shots.find((s) => s.roundId === roundId && s.hole === n && s.seq === 1);
    if (tee) tee.startDist = fields.yards;
  }
  rememberCourse(r);
  persist();
}

export function completeRound(roundId) {
  const r = db.rounds.find((x) => x.id === roundId);
  r.status = 'complete';
  r.completedAt = new Date().toISOString();
  rememberCourse(r);
  persist();
}

export function reopenRound(roundId) {
  for (const r of db.rounds) if (r.status === 'in_progress' && r.id !== roundId) r.status = 'complete';
  const r = db.rounds.find((x) => x.id === roundId);
  r.status = 'in_progress';
  persist();
}

export function deleteRound(roundId) {
  db.rounds = db.rounds.filter((r) => r.id !== roundId);
  db.shots = db.shots.filter((s) => s.roundId !== roundId);
  persist();
}

// ---- Shots ----
export function shotsFor(roundId, hole) {
  return db.shots
    .filter((s) => s.roundId === roundId && (hole == null || s.hole === hole))
    .sort((a, b) => a.hole - b.hole || a.seq - b.seq);
}

export function addShot(shot) {
  const prev = shotsFor(shot.roundId, shot.hole);
  const s = { id: uid(), seq: prev.length + 1, createdAt: new Date().toISOString(), ...shot };
  db.shots.push(s);
  persist();
  return s;
}

export function removeLastShot(roundId, hole) {
  const list = shotsFor(roundId, hole);
  if (!list.length) return null;
  const last = list[list.length - 1];
  db.shots = db.shots.filter((s) => s.id !== last.id);
  persist();
  return last;
}

// ---- Backup ----
export function exportJSON() {
  return JSON.stringify({ ...db, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const doc = JSON.parse(text);
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.rounds) || !Array.isArray(doc.shots)) {
    throw new Error('This file is not a Golf Coach backup.');
  }
  delete doc.exportedAt;
  db = migrate(doc);
  persist();
}

export function resetAll() {
  db = empty();
  persist();
}
