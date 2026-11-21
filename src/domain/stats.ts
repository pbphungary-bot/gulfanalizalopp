import { DRILL_BY_ID } from './drills';
import { roundScore, roundStrokesGained } from './strokesGained';
import type { DrillLog, Round, Shot } from './types';

/** Score for a round, only if every hole was holed out. Partial rounds would skew averages. */
export function completedScore(round: Round, shots: Shot[]): number | null {
  const holed = new Set(shots.filter((s) => s.endLie === 'holed').map((s) => s.hole));
  return holed.size >= round.holes ? roundScore(shots) : null;
}

export function averageScore(rounds: { round: Round; shots: Shot[] }[]): { avg: number; n: number } | null {
  const scores = rounds.map((r) => completedScore(r.round, r.shots)).filter((x): x is number => x !== null);
  if (!scores.length) return null;
  return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, n: scores.length };
}

/** Average total strokes gained per round over the given rounds (those with shots). */
export function averageStrokesGained(rounds: { shots: Shot[] }[]): { avg: number; n: number } | null {
  const withShots = rounds.filter((r) => r.shots.length > 0);
  if (!withShots.length) return null;
  const total = withShots.reduce((a, r) => a + roundStrokesGained(r.shots).totals.total, 0);
  return { avg: total / withShots.length, n: withShots.length };
}

/** Monday 00:00 local time of the current week. */
export function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dow);
  return d;
}

/** Practice minutes this week, counted from logged drills (planned time of each drill). */
export function practiceMinutesThisWeek(logs: DrillLog[], now = new Date()): number {
  const from = startOfWeek(now).getTime();
  return logs
    .filter((l) => new Date(l.loggedAt).getTime() >= from)
    .reduce((a, l) => a + (DRILL_BY_ID[l.drillId]?.minutes ?? 0), 0);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
