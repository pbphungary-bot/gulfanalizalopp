import type { Drill, MsgParam, TFn } from './types';
import { longUnit, shortUnit, UnitSystem } from './units';

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

type P = Record<string, MsgParam>;

/**
 * Distances inside drill text. Metric drills use round metre numbers that are close to the
 * imperial ones, not exact conversions. {u} is the long unit (m / yd), {s} the short one (m / ft).
 */
const DRILL_NUMBERS: Record<string, Record<UnitSystem, P>> = {
  'tee-fairway-gate': { metric: { w: 25 }, imperial: { w: 30 } },
  'app-distance-ladder': { metric: { a: 80, b: 100, c: 120, tol: 5 }, imperial: { a: 90, b: 110, c: 130, tol: 5 } },
  'app-random-targets': { metric: { lo: 80, hi: 150, r: 15 }, imperial: { lo: 90, hi: 160, r: 15 } },
  'short-landing-spot': { metric: { d: 15, tol: 1 }, imperial: { d: 15, tol: 1 } },
  'putt-gate-3ft': { metric: { a: 1, b: 2, c: '30 cm' }, imperial: { a: 3, b: 6, c: '1 ft' } },
  'putt-lag-ladder': { metric: { a: 6, b: 9, c: 12, t: 1 }, imperial: { a: 20, b: 30, c: 40, t: 3 } },
  'putt-clock-5ft': { metric: { a: 1.5 }, imperial: { a: 5 } },
};

/** Translated text for a drill, with distances in the player's unit system. */
export function drillText(d: Drill, t: TFn, system: UnitSystem = 'metric') {
  const p: P = { ...(DRILL_NUMBERS[d.id]?.[system] ?? {}), u: longUnit(system), s: shortUnit(system) };
  return {
    name: t(`drill.${d.id}.name`, p),
    goal: t(`drill.${d.id}.goal`, p),
    steps: Array.from({ length: d.steps }, (_, i) => t(`drill.${d.id}.step.${i + 1}`, p)),
    rule: t(`drill.${d.id}.rule`, p),
  };
}
