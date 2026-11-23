import * as SQLite from 'expo-sqlite';
import type { DrillLog, Profile, Round, SgCategory, Shot, WeeklyPlan } from '../domain/types';
import { DEFAULT_PROFILE } from '../domain/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const M_PER_YD = 0.9144;
const M_PER_FT = 0.3048;

/**
 * Earlier versions stored distances in yards (feet on the green). From now on everything is in
 * metres. This converts existing rows once, all or nothing, and records that it has run.
 */
async function migrateToMetres(db: SQLite.SQLiteDatabase): Promise<void> {
  const done = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'migration:metres'");
  if (done) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE shots SET
         start_dist = start_dist * CASE WHEN start_lie = 'green' THEN ? ELSE ? END,
         end_dist = end_dist * CASE WHEN end_lie = 'green' THEN ? ELSE ? END`,
      M_PER_FT, M_PER_YD, M_PER_FT, M_PER_YD,
    );
    // These tables are created on first use, so they may not exist yet.
    for (const [table, columns] of [['club_distances', ['carry', 'total']], ['monitor_shots', ['carry', 'total']]] as const) {
      const exists = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table);
      if (!exists) continue;
      for (const col of columns) await db.runAsync(`UPDATE ${table} SET ${col} = ${col} * ?`, M_PER_YD);
    }
    await db.runAsync("INSERT INTO kv (key, value) VALUES ('migration:metres', '\"done\"')");
  });
}

/** Local-first: everything lives on the device so rounds work with no signal. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('golf.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS rounds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          course TEXT NOT NULL, played_at TEXT NOT NULL, holes INTEGER NOT NULL,
          par_total INTEGER NOT NULL, kind TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS shots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
          hole INTEGER NOT NULL, par INTEGER NOT NULL, shot_no INTEGER NOT NULL,
          club TEXT NOT NULL, start_lie TEXT NOT NULL, start_dist REAL NOT NULL,
          end_lie TEXT NOT NULL, end_dist REAL NOT NULL, penalty INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_shots_round ON shots(round_id);
        CREATE TABLE IF NOT EXISTS drill_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          drill_id TEXT NOT NULL, category TEXT NOT NULL, logged_at TEXT NOT NULL,
          attempts INTEGER NOT NULL, successes INTEGER NOT NULL, feeling INTEGER NOT NULL, note TEXT NOT NULL DEFAULT ''
        );
      `);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrateToMetres(db);
      return db;
    })();
  }
  return dbPromise;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}
async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}

export const getSetting = <T,>(key: string) => kvGet<T>(`setting:${key}`);
export const saveSetting = (key: string, value: unknown) => kvSet(`setting:${key}`, value);

export async function getProfile(): Promise<Profile | null> {
  const p = await kvGet<Profile>('profile');
  return p ? { ...DEFAULT_PROFILE, ...p } : null;
}
export const saveProfile = (p: Profile) => kvSet('profile', p);

export const getPlan = () => kvGet<WeeklyPlan>('plan');
export const savePlan = (p: WeeklyPlan) => kvSet('plan', p);

type RoundRow = { id: number; course: string; played_at: string; holes: number; par_total: number; kind: Round['kind'] };
const toRound = (r: RoundRow): Round => ({ id: r.id, course: r.course, playedAt: r.played_at, holes: r.holes, parTotal: r.par_total, kind: r.kind });

export async function createRound(r: Omit<Round, 'id'>): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO rounds (course, played_at, holes, par_total, kind) VALUES (?, ?, ?, ?, ?)',
    r.course, r.playedAt, r.holes, r.parTotal, r.kind,
  );
  return res.lastInsertRowId;
}

export async function listRounds(): Promise<Round[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoundRow>('SELECT * FROM rounds ORDER BY played_at DESC, id DESC');
  return rows.map(toRound);
}

export async function getRound(id: number): Promise<Round | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoundRow>('SELECT * FROM rounds WHERE id = ?', id);
  return row ? toRound(row) : null;
}

export async function deleteRound(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM shots WHERE round_id = ?', id);
  await db.runAsync('DELETE FROM rounds WHERE id = ?', id);
}

type ShotRow = {
  id: number; round_id: number; hole: number; par: number; shot_no: number; club: string;
  start_lie: Shot['startLie']; start_dist: number; end_lie: Shot['endLie']; end_dist: number; penalty: number;
};
const toShot = (r: ShotRow): Shot => ({
  id: r.id, roundId: r.round_id, hole: r.hole, par: r.par, shotNo: r.shot_no, club: r.club,
  startLie: r.start_lie, startDist: r.start_dist, endLie: r.end_lie, endDist: r.end_dist, penalty: r.penalty,
});

export async function addShot(s: Omit<Shot, 'id'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO shots (round_id, hole, par, shot_no, club, start_lie, start_dist, end_lie, end_dist, penalty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.roundId, s.hole, s.par, s.shotNo, s.club, s.startLie, s.startDist, s.endLie, s.endDist, s.penalty,
  );
}

export async function deleteLastShot(roundId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM shots WHERE id = (SELECT id FROM shots WHERE round_id = ? ORDER BY id DESC LIMIT 1)',
    roundId,
  );
}

export async function shotsForRound(roundId: number): Promise<Shot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ShotRow>('SELECT * FROM shots WHERE round_id = ? ORDER BY hole, shot_no', roundId);
  return rows.map(toShot);
}

export async function shotsByRound(limit = 10): Promise<{ round: Round; shots: Shot[] }[]> {
  const rounds = (await listRounds()).slice(0, limit);
  return Promise.all(rounds.map(async (round) => ({ round, shots: await shotsForRound(round.id) })));
}

export async function addDrillLog(l: Omit<DrillLog, 'id'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO drill_logs (drill_id, category, logged_at, attempts, successes, feeling, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    l.drillId, l.category, l.loggedAt, l.attempts, l.successes, l.feeling, l.note,
  );
}

export async function listDrillLogs(limit = 60): Promise<DrillLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number; drill_id: string; category: SgCategory; logged_at: string; attempts: number; successes: number; feeling: DrillLog['feeling']; note: string;
  }>('SELECT * FROM drill_logs ORDER BY id DESC LIMIT ?', limit);
  return rows.map((r) => ({
    id: r.id, drillId: r.drill_id, category: r.category, loggedAt: r.logged_at,
    attempts: r.attempts, successes: r.successes, feeling: r.feeling, note: r.note,
  }));
}
