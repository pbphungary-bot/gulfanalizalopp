import type { ClubDistance, DistanceSource } from '../domain/clubs';
import type { ClubAverage, ImportShot } from '../domain/importer';
import { getDb } from './index';

let ready: Promise<void> | null = null;

async function ensure(): Promise<void> {
  if (!ready) {
    ready = getDb().then((db) =>
      db.execAsync(`
        CREATE TABLE IF NOT EXISTS club_distances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          club TEXT NOT NULL, carry REAL NOT NULL, total REAL,
          source TEXT NOT NULL, shots INTEGER, recorded_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_club_distances_club ON club_distances(club);
        CREATE TABLE IF NOT EXISTS monitor_shots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_name TEXT NOT NULL, imported_at TEXT NOT NULL, club TEXT NOT NULL,
          carry REAL NOT NULL, total REAL, club_speed REAL, ball_speed REAL, excluded INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_monitor_shots_club ON monitor_shots(club);
      `),
    );
  }
  await ready;
}

type Row = {
  id: number; club: string; carry: number; total: number | null; source: DistanceSource;
  shots: number | null; recorded_at: string; note: string;
};

export async function listClubDistances(): Promise<ClubDistance[]> {
  await ensure();
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM club_distances ORDER BY recorded_at DESC, id DESC');
  return rows.map((r) => ({
    id: r.id, club: r.club, carry: r.carry, total: r.total, source: r.source,
    shots: r.shots, recordedAt: r.recorded_at, note: r.note,
  }));
}

export async function addClubDistance(d: Omit<ClubDistance, 'id'>): Promise<void> {
  await ensure();
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO club_distances (club, carry, total, source, shots, recorded_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    d.club, d.carry, d.total, d.source, d.shots, d.recordedAt, d.note,
  );
}

export async function deleteClubDistance(id: number): Promise<void> {
  await ensure();
  const db = await getDb();
  await db.runAsync('DELETE FROM club_distances WHERE id = ?', id);
}

/**
 * Save a launch monitor import: one averaged entry per chosen club for the history,
 * and every individual shot (including ones left out of the average) so nothing is lost.
 */
export async function saveImport(args: { fileName: string; averages: ClubAverage[]; shots: ImportShot[] }): Promise<void> {
  await ensure();
  const db = await getDb();
  const at = new Date().toISOString();
  const keep = new Set(args.averages.map((a) => a.club));
  await db.withTransactionAsync(async () => {
    for (const a of args.averages) {
      await db.runAsync(
        'INSERT INTO club_distances (club, carry, total, source, shots, recorded_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        a.club, Math.round(a.carry * 10) / 10, a.total === null ? null : Math.round(a.total * 10) / 10,
        'monitor', a.used, at, `Imported from ${args.fileName}`,
      );
    }
    for (const s of args.shots) {
      if (!keep.has(s.club)) continue;
      await db.runAsync(
        'INSERT INTO monitor_shots (file_name, imported_at, club, carry, total, club_speed, ball_speed, excluded) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args.fileName, at, s.club, s.carry, s.total, s.clubSpeed, s.ballSpeed, s.excluded ? 1 : 0,
      );
    }
  });
}
