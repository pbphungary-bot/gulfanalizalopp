import type { GymExercise } from './gym';
import type { Msg, TFn } from './types';

export interface LoggedSet {
  weight: number | null;
  reps: number;
}

export interface Suggestion {
  /** Weight to start with today in kg, if one can be suggested */
  weight: number | null;
  /** Language-neutral text; translate with tm() */
  msg: Msg;
}

/** "3 × 8 @ 57.5 kg" when every set matches, otherwise "8, 8, 7 @ 57.5 kg". */
export function formatSets(sets: LoggedSet[], t: TFn): string {
  if (!sets.length) return '';
  const weights = [...new Set(sets.map((s) => s.weight))];
  const w =
    weights.length === 1 && weights[0] !== null
      ? t('sets.at', { w: weights[0] })
      : weights.some((x) => x !== null)
        ? t('sets.vary')
        : '';
  const allSame = sets.every((s) => s.reps === sets[0].reps);
  return allSame
    ? t('sets.same', { n: sets.length, reps: sets[0].reps, w })
    : t('sets.list', { list: sets.map((s) => s.reps).join(', '), w });
}

/**
 * A plain double-progression rule: stay at a weight until every set reaches the top of the
 * rep range, then add the smallest sensible jump. General training guidance, not a prescription.
 */
export function suggestNext(exercise: GymExercise, last: LoggedSet[] | null): Suggestion {
  const top = exercise.repsHigh;
  const low = exercise.repsLow;
  if (!last || last.length === 0) {
    const k = exercise.kind === 'weight' ? 'prog.firstWeight' : exercise.kind === 'band' ? 'prog.firstBand' : 'prog.firstBody';
    return { weight: null, msg: { k, p: { low, top } } };
  }

  const completedAllSets = last.length >= exercise.sets;
  const allAtTop = completedAllSets && last.every((s) => s.reps >= top);
  const anyBelowLow = last.some((s) => s.reps < low);

  if (exercise.kind === 'weight') {
    const weights = last.map((s) => s.weight).filter((w): w is number => w !== null);
    const w = weights.length ? Math.max(...weights) : null;
    if (w === null) return { weight: null, msg: { k: 'prog.logWeight' } };
    if (allAtTop) {
      const next = Math.round((w + exercise.step) * 10) / 10;
      return { weight: next, msg: { k: 'prog.addWeight', p: { top, w, next } } };
    }
    if (anyBelowLow) return { weight: w, msg: { k: 'prog.stayLow', p: { w, low } } };
    return { weight: w, msg: { k: 'prog.stayTop', p: { w, top } } };
  }

  if (exercise.kind === 'band') {
    return allAtTop
      ? { weight: null, msg: { k: 'prog.bandTop' } }
      : { weight: null, msg: { k: 'prog.bandSame', p: { top } } };
  }

  return allAtTop
    ? { weight: null, msg: { k: 'prog.bodyTop' } }
    : { weight: null, msg: { k: 'prog.bodySame', p: { top } } };
}
