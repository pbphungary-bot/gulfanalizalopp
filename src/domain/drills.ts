import type { Drill, TFn } from './types';

export const DRILLS: Drill[] = [
  { id: 'tee-fairway-gate', category: 'tee', minutes: 20, needs: 'range', steps: 3 },
  { id: 'tee-shape-control', category: 'tee', minutes: 20, needs: 'range', steps: 2 },
  { id: 'app-distance-ladder', category: 'approach', minutes: 15, needs: 'range', steps: 3 },
  { id: 'app-random-targets', category: 'approach', minutes: 20, needs: 'range', steps: 2 },
  { id: 'app-pressure-ten', category: 'approach', minutes: 15, needs: 'range', steps: 2 },
  { id: 'short-landing-spot', category: 'short', minutes: 20, needs: 'short', steps: 3 },
  { id: 'short-updown-game', category: 'short', minutes: 25, needs: 'short', steps: 3 },
  { id: 'putt-gate-3ft', category: 'putting', minutes: 10, needs: 'putting', steps: 3 },
  { id: 'putt-lag-ladder', category: 'putting', minutes: 15, needs: 'putting', steps: 2 },
  { id: 'putt-clock-5ft', category: 'putting', minutes: 15, needs: 'putting', steps: 2 },
];

export const DRILL_BY_ID: Record<string, Drill> = Object.fromEntries(DRILLS.map((d) => [d.id, d]));

/** Translated text for a drill. */
export function drillText(d: Drill, t: TFn) {
  return {
    name: t(`drill.${d.id}.name`),
    goal: t(`drill.${d.id}.goal`),
    steps: Array.from({ length: d.steps }, (_, i) => t(`drill.${d.id}.step.${i + 1}`)),
    rule: t(`drill.${d.id}.rule`),
  };
}
