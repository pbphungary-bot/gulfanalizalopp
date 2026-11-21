import type { Lie, SgCategory, Shot } from './types';

/**
 * IMPORTANT: PLACEHOLDER BASELINE.
 * These expected-strokes numbers are rough, rounded approximations meant to make
 * the strokes-gained pipeline work end to end. Before this ships to users, replace
 * them with a properly licensed or validated reference dataset (see README).
 */

type Pt = [number, number];

const FAIRWAY_YDS: Pt[] = [
  [10, 2.2], [20, 2.4], [40, 2.6], [60, 2.7], [80, 2.75], [100, 2.8], [120, 2.85],
  [140, 2.91], [160, 2.98], [180, 3.08], [200, 3.19], [240, 3.45], [280, 3.68],
  [320, 3.87], [360, 3.99], [400, 4.08], [440, 4.17], [480, 4.28], [520, 4.41],
  [560, 4.55], [600, 4.7],
];

const GREEN_FT: Pt[] = [
  [1, 1.0], [3, 1.04], [5, 1.15], [8, 1.5], [10, 1.61], [15, 1.78], [20, 1.87],
  [30, 1.98], [40, 2.06], [60, 2.2], [90, 2.4],
];

function interp(table: Pt[], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/** Expected strokes to hole out from a position. Distance: yards, or feet on the green. */
export function expectedStrokes(lie: Lie, dist: number): number {
  if (lie === 'holed') return 0;
  if (lie === 'green') return interp(GREEN_FT, dist);
  const base = interp(FAIRWAY_YDS, dist);
  switch (lie) {
    case 'tee':
    case 'fairway':
      return base;
    case 'rough':
      return base + (dist < 100 ? 0.12 : 0.22);
    case 'sand':
      return base + (dist < 50 ? 0.4 : 0.25);
    case 'recovery':
      return base + 0.7;
    case 'penalty':
      return base + 0.3;
  }
}

export function categorize(shot: Pick<Shot, 'startLie' | 'startDist' | 'shotNo' | 'par'>): SgCategory {
  if (shot.startLie === 'green') return 'putting';
  if (shot.startLie === 'tee' && shot.par >= 4) return 'tee';
  if (shot.startDist <= 30) return 'short';
  return 'approach';
}

export interface ShotSg {
  shot: Shot;
  category: SgCategory;
  sg: number;
}

export function shotStrokesGained(shot: Shot): ShotSg {
  const before = expectedStrokes(shot.startLie, shot.startDist);
  const after = expectedStrokes(shot.endLie, shot.endDist);
  const sg = before - after - 1 - shot.penalty;
  return { shot, category: categorize(shot), sg };
}

export type SgTotals = Record<SgCategory, number> & { total: number };

export function emptyTotals(): SgTotals {
  return { tee: 0, approach: 0, short: 0, putting: 0, total: 0 };
}

export function roundStrokesGained(shots: Shot[]): { totals: SgTotals; perShot: ShotSg[] } {
  const perShot = shots.map(shotStrokesGained);
  const totals = emptyTotals();
  for (const s of perShot) {
    totals[s.category] += s.sg;
    totals.total += s.sg;
  }
  return { totals, perShot };
}

/** Strokes in a round = shots + penalties */
export function roundScore(shots: Shot[]): number {
  return shots.length + shots.reduce((a, s) => a + s.penalty, 0);
}

export interface ApproachBand {
  label: string;
  shots: number;
  avgSg: number;
}

/** Approach performance by starting distance, to find the real weak spot. */
export function approachBands(shots: Shot[]): ApproachBand[] {
  const bands: [string, number, number][] = [
    ['30–75 yd', 30, 75], ['75–125 yd', 75, 125], ['125–175 yd', 125, 175], ['175+ yd', 175, 999],
  ];
  return bands
    .map(([label, lo, hi]) => {
      const inBand = shots
        .map(shotStrokesGained)
        .filter((s) => s.category === 'approach' && s.shot.startDist > lo && s.shot.startDist <= hi);
      const avgSg = inBand.length ? inBand.reduce((a, s) => a + s.sg, 0) / inBand.length : 0;
      return { label, shots: inBand.length, avgSg };
    })
    .filter((b) => b.shots > 0);
}
