import { DRILLS } from './drills';
import { approachBands, roundStrokesGained, SgTotals } from './strokesGained';
import type { Drill, DrillLog, PlannedSession, Profile, SgCategory, Shot, WeeklyPlan } from './types';
import { SG_LABEL } from './types';

const CATS: SgCategory[] = ['tee', 'approach', 'short', 'putting'];

export interface Diagnosis {
  roundsAnalyzed: number;
  avgPerRound: SgTotals;
  weakest: SgCategory | null;
  messages: string[];
  hasEnoughData: boolean;
}

/** Need at least this many holes of shot data before trusting the numbers. */
const MIN_ROUNDS = 2;

export function diagnose(shotsByRound: Shot[][]): Diagnosis {
  const rounds = shotsByRound.filter((r) => r.length > 0);
  const sum: SgTotals = { tee: 0, approach: 0, short: 0, putting: 0, total: 0 };
  for (const shots of rounds) {
    const { totals } = roundStrokesGained(shots);
    for (const c of CATS) sum[c] += totals[c];
    sum.total += totals.total;
  }
  const n = Math.max(rounds.length, 1);
  const avg: SgTotals = {
    tee: sum.tee / n, approach: sum.approach / n, short: sum.short / n, putting: sum.putting / n, total: sum.total / n,
  };
  const hasEnoughData = rounds.length >= MIN_ROUNDS;
  const messages: string[] = [];
  let weakest: SgCategory | null = null;

  if (rounds.length === 0) {
    messages.push('Record a round to get your first diagnosis.');
  } else {
    weakest = CATS.reduce((a, b) => (avg[a] <= avg[b] ? a : b));
    if (!hasEnoughData) {
      messages.push(`Only ${rounds.length} round recorded. Treat this as an early indication, not a verdict.`);
    }
    messages.push(
      `${SG_LABEL[weakest]} is costing you the most: ${avg[weakest].toFixed(1)} strokes per round against the baseline.`,
    );
    if (weakest === 'approach') {
      const bands = approachBands(rounds.flat()).filter((b) => b.shots >= 3);
      if (bands.length) {
        const worst = bands.reduce((a, b) => (a.avgSg <= b.avgSg ? a : b));
        messages.push(`Your weakest approach range is ${worst.label} (${worst.avgSg.toFixed(2)} per shot).`);
      }
    }
    const best = CATS.reduce((a, b) => (avg[a] >= avg[b] ? a : b));
    if (best !== weakest && avg[best] > 0) {
      messages.push(`${SG_LABEL[best]} is a strength. Don't over-practice it.`);
    }
  }
  return { roundsAnalyzed: rounds.length, avgPerRound: avg, weakest, messages, hasEnoughData };
}

/** 0..1 — how well a player is succeeding at drills in a category, from the most recent logs. */
export function mastery(logs: DrillLog[], category: SgCategory): number | null {
  const recent = logs.filter((l) => l.category === category).slice(0, 6);
  const attempts = recent.reduce((a, l) => a + l.attempts, 0);
  if (attempts < 10) return null; // not enough evidence
  return recent.reduce((a, l) => a + l.successes, 0) / attempts;
}

/**
 * Practice time split. Starts from where strokes are being lost, then eases off a
 * category when drill results show it is already going well (the "adapt" step).
 */
export function allocate(diag: Diagnosis, logs: DrillLog[]): Record<SgCategory, number> {
  const weights: Record<SgCategory, number> = { tee: 1, approach: 1, short: 1, putting: 1 };
  if (diag.roundsAnalyzed > 0) {
    for (const c of CATS) {
      const loss = Math.max(0, -diag.avgPerRound[c]);
      weights[c] = 0.5 + loss; // floor so nothing is ignored
    }
  }
  for (const c of CATS) {
    const m = mastery(logs, c);
    if (m !== null && m >= 0.7) weights[c] *= 0.6;
  }
  const total = CATS.reduce((a, c) => a + weights[c], 0);
  const out = { tee: 0, approach: 0, short: 0, putting: 0 };
  let used = 0;
  for (const c of CATS) {
    out[c] = Math.round((weights[c] / total) * 100);
    used += out[c];
  }
  // fix rounding drift on the largest bucket
  const biggest = CATS.reduce((a, b) => (out[a] >= out[b] ? a : b));
  out[biggest] += 100 - used;
  return out;
}

function availableDrills(profile: Profile, category: SgCategory): Drill[] {
  const ok = (d: Drill) =>
    d.needs === 'none' ||
    (d.needs === 'range' && profile.hasRange) ||
    (d.needs === 'putting' && profile.hasPuttingGreen) ||
    (d.needs === 'short' && profile.hasShortGameArea);
  return DRILLS.filter((d) => d.category === category && ok(d));
}

/** Rotate drills so consecutive weeks differ. */
function pickDrills(pool: Drill[], minutes: number, seed: number): string[] {
  if (!pool.length) return [];
  const picked: string[] = [];
  let left = minutes;
  for (let i = 0; i < pool.length && left > 0; i++) {
    const d = pool[(i + seed) % pool.length];
    if (picked.includes(d.id)) continue;
    picked.push(d.id);
    left -= d.minutes;
  }
  return picked;
}

const GYM_ROTATION: NonNullable<PlannedSession['gymTemplate']>[] = ['strength', 'power', 'mobility'];
const GYM_TITLE = {
  strength: 'Gym: Golf strength',
  power: 'Gym: Rotational power',
  mobility: 'Gym: Mobility',
} as const;

/**
 * Build a weekly plan. `roundDay` (0=Mon … 6=Sun) is the day the player intends to play;
 * heavy gym work is kept away from it.
 */
export function buildWeeklyPlan(
  profile: Profile,
  diag: Diagnosis,
  logs: DrillLog[],
  opts: { roundDay?: number; seed?: number } = {},
): WeeklyPlan {
  const roundDay = opts.roundDay ?? 5;
  const seed = opts.seed ?? 0;
  const allocation = allocate(diag, logs);
  const order = [...CATS].sort((a, b) => allocation[b] - allocation[a]);

  const rationale: string[] = [...diag.messages];
  rationale.push(
    `Time split — ${CATS.map((c) => `${SG_LABEL[c]} ${allocation[c]}%`).join(', ')}.`,
  );
  for (const c of CATS) {
    const m = mastery(logs, c);
    if (m !== null && m >= 0.7) {
      rationale.push(`${SG_LABEL[c]} drills are going well (${Math.round(m * 100)}% success), so it gets less time.`);
    }
  }

  const sessions: PlannedSession[] = [];
  const used = new Set<number>([roundDay]);
  sessions.push({ day: roundDay, kind: 'round', title: 'Play a round and track every shot', minutes: 240 });

  // Choose practice days: spread through the week, never day-before a round if possible.
  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !used.has(d));
  const practiceDays: number[] = [];
  const pdBefore = (roundDay + 6) % 7;
  const candidates = free.filter((d) => d !== pdBefore).concat(free.filter((d) => d === pdBefore));
  for (const d of candidates) {
    if (practiceDays.length >= Math.max(1, profile.practiceDaysPerWeek)) break;
    practiceDays.push(d);
    used.add(d);
  }
  practiceDays.sort((a, b) => a - b);

  const perSessionMinutes = Math.round(profile.practiceMinutesPerWeek / Math.max(1, practiceDays.length));
  // Assign categories to days weighted by allocation using largest-remainder style cycling.
  const slots: SgCategory[] = [];
  const totalSlots = practiceDays.length;
  const quota = Object.fromEntries(CATS.map((c) => [c, (allocation[c] / 100) * totalSlots])) as Record<SgCategory, number>;
  const given: Record<SgCategory, number> = { tee: 0, approach: 0, short: 0, putting: 0 };
  while (slots.length < totalSlots) {
    const next = order.reduce((a, b) => (quota[a] - given[a] >= quota[b] - given[b] ? a : b));
    slots.push(next);
    given[next]++;
  }

  practiceDays.forEach((day, i) => {
    const cat = slots[i];
    const pool = availableDrills(profile, cat);
    const drillIds = pickDrills(pool, perSessionMinutes, seed + i);
    sessions.push({
      day,
      kind: 'practice',
      category: cat,
      title: `${SG_LABEL[cat]} practice`,
      minutes: perSessionMinutes,
      drillIds,
    });
  });

  if (profile.hasGym) {
    const gymCandidates = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== roundDay && d !== pdBefore);
    let g = 0;
    for (const d of gymCandidates) {
      if (g >= profile.gymDaysPerWeek) break;
      const template = GYM_ROTATION[(g + seed) % GYM_ROTATION.length];
      // keep power/strength off the day before the round
      const dayBeforeRound = d === pdBefore;
      sessions.push({
        day: d,
        kind: 'gym',
        gymTemplate: dayBeforeRound ? 'mobility' : template,
        title: GYM_TITLE[dayBeforeRound ? 'mobility' : template],
        minutes: 45,
      });
      g++;
    }
  }

  const dayBeforeBusy = sessions.some((s) => s.day === pdBefore);
  if (!dayBeforeBusy) {
    sessions.push({ day: pdBefore, kind: 'recovery', title: 'Light mobility before round day', minutes: 20 });
  }

  sessions.sort((a, b) => a.day - b.day);
  return {
    createdAt: new Date().toISOString(),
    focus: order[0],
    allocation,
    rationale,
    sessions,
  };
}
