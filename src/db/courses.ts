import { BUILTIN_COURSES, Course, Gender } from '../domain/courses';
import { getDb, getSetting, saveSetting } from './index';

let ready: Promise<void> | null = null;

async function ensure(): Promise<void> {
  if (!ready) {
    ready = getDb().then(async (db) => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL)');
      // Built-in courses are refreshed on every start so corrections ship with the app.
      for (const c of BUILTIN_COURSES) {
        await db.runAsync('INSERT OR REPLACE INTO courses (id, data) VALUES (?, ?)', c.id, JSON.stringify(c));
      }
    });
  }
  await ready;
}

export async function listCourses(): Promise<Course[]> {
  await ensure();
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM courses');
  return rows.map((r) => JSON.parse(r.data) as Course).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCourse(id: string): Promise<Course | null> {
  await ensure();
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM courses WHERE id = ?', id);
  return row ? (JSON.parse(row.data) as Course) : null;
}

export async function saveCourse(c: Course): Promise<void> {
  await ensure();
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO courses (id, data) VALUES (?, ?)', c.id, JSON.stringify({ ...c, builtin: false }));
}

export async function deleteCourse(id: string): Promise<void> {
  await ensure();
  const db = await getDb();
  await db.runAsync('DELETE FROM courses WHERE id = ? AND id NOT IN (' + BUILTIN_COURSES.map(() => '?').join(',') + ')', id, ...BUILTIN_COURSES.map((c) => c.id));
}

/** Which course, tee and gender a round is played from. Rounds without one use hand entry. */
export interface RoundPlan {
  courseId: string;
  teeId: string;
  gender: Gender;
}
export const getRoundPlan = (roundId: number) => getSetting<RoundPlan>(`roundplan:${roundId}`);
export const saveRoundPlan = (roundId: number, p: RoundPlan) => saveSetting(`roundplan:${roundId}`, p);
