import type { LoggedSet } from '../domain/progression';
import type { GymTemplateKey } from '../domain/gym';
import { getDb } from './index';

export interface GymSet extends LoggedSet {
  id: number;
  exerciseId: string;
  template: GymTemplateKey;
  sessionDay: string; // local date, YYYY-MM-DD
  setNo: number;
  loggedAt: string;
}

let ready: Promise<void> | null = null;
async function ensure(): Promise<void> {
  if (!ready) {
    ready = getDb().then((db) =>
      db.execAsync(`
        CREATE TABLE IF NOT EXISTS gym_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercise_id TEXT NOT NULL, template TEXT NOT NULL, session_day TEXT NOT NULL,
          set_no INTEGER NOT NULL, weight REAL, reps INTEGER NOT NULL, logged_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_gym_sets_ex ON gym_sets(exercise_id, session_day);
      `),
    );
  }
  await ready;
}

/** Local calendar day, so a late-evening workout stays on the day it happened. */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Row = { id: number; exercise_id: string; template: GymTemplateKey; session_day: string; set_no: number; weight: number | null; reps: number; logged_at: string };
const toSet = (r: Row): GymSet => ({
  id: r.id, exerciseId: r.exercise_id, template: r.template, sessionDay: r.session_day,
  setNo: r.set_no, weight: r.weight, reps: r.reps, loggedAt: r.logged_at,
});

export async function logGymSet(s: { exerciseId: string; template: GymTemplateKey; setNo: number; weight: number | null; reps: number }): Promise<void> {
  await ensure();
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO gym_sets (exercise_id, template, session_day, set_no, weight, reps, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    s.exerciseId, s.template, localDay(), s.setNo, s.weight, s.reps, new Date().toISOString(),
  );
}

export async function deleteGymSet(id: number): Promise<void> {
  await ensure();
  const db = await getDb();
  await db.runAsync('DELETE FROM gym_sets WHERE id = ?', id);
}

export async function setsToday(exerciseId: string): Promise<GymSet[]> {
  await ensure();
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM gym_sets WHERE exercise_id = ? AND session_day = ? ORDER BY id', exerciseId, localDay());
  return rows.map(toSet);
}

/** The most recent earlier day this exercise was logged, so "last time" never means "a minute ago". */
export async function lastSessionSets(exerciseId: string): Promise<GymSet[]> {
  await ensure();
  const db = await getDb();
  const day = await db.getFirstAsync<{ session_day: string }>(
    'SELECT session_day FROM gym_sets WHERE exercise_id = ? AND session_day < ? ORDER BY session_day DESC LIMIT 1',
    exerciseId, localDay(),
  );
  if (!day) return [];
  const rows = await db.getAllAsync<Row>('SELECT * FROM gym_sets WHERE exercise_id = ? AND session_day = ? ORDER BY set_no, id', exerciseId, day.session_day);
  return rows.map(toSet);
}

/** Number of distinct gym sessions (a day plus a workout type) logged since the given local day. */
export async function sessionsSince(day: string): Promise<number> {
  await ensure();
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM (SELECT DISTINCT session_day, template FROM gym_sets WHERE session_day >= ?)",
    day,
  );
  return row?.n ?? 0;
}
