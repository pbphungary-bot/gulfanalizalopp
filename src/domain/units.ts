/**
 * Distances are stored in metres everywhere. These helpers convert for display and input.
 * "Long" distances are course-scale (metres or yards); "short" distances are on the green
 * (metres or feet).
 */
export type UnitSystem = 'metric' | 'imperial';

export const M_PER_YD = 0.9144;
export const M_PER_FT = 0.3048;
export const YD_PER_M = 1 / M_PER_YD;
export const FT_PER_M = 1 / M_PER_FT;

export const longFromM = (m: number, sys: UnitSystem) => (sys === 'metric' ? m : m * YD_PER_M);
export const longToM = (v: number, sys: UnitSystem) => (sys === 'metric' ? v : v * M_PER_YD);
export const shortFromM = (m: number, sys: UnitSystem) => (sys === 'metric' ? m : m * FT_PER_M);
export const shortToM = (v: number, sys: UnitSystem) => (sys === 'metric' ? v : v * M_PER_FT);

export const longUnit = (sys: UnitSystem) => (sys === 'metric' ? 'm' : 'yd');
export const shortUnit = (sys: UnitSystem) => (sys === 'metric' ? 'm' : 'ft');

/** Metric if the phone says so; otherwise by language (Hungarian phones default to metric). */
export function defaultSystem(measurement: string | null | undefined, isHungarian: boolean): UnitSystem {
  if (measurement === 'metric') return 'metric';
  if (measurement === 'us' || measurement === 'uk') return 'imperial';
  return isHungarian ? 'metric' : 'imperial';
}

/** An approach band in metres. `hiM` is null for the open-ended last band. */
export interface BandEdges {
  loM: number;
  hiM: number | null;
}

/** "125–175 yd", "160+ m" */
export function formatBand(b: BandEdges, sys: UnitSystem): string {
  const lo = Math.round(longFromM(b.loM, sys));
  const u = longUnit(sys);
  if (b.hiM === null) return `${lo}+ ${u}`;
  return `${lo}–${Math.round(longFromM(b.hiM, sys))} ${u}`;
}
