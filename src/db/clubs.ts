import type { ClubDistance, DistanceSource } from '../domain/clubs';
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
