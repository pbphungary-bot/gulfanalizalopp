import type { GymExercise } from './gym';

export interface LoggedSet {
  weight: number | null;
  reps: number;
}

export interface Suggestion {
  /** Weight to start with today in kg, if one can be suggested */
  weight: number | null;
  text: string;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "3 × 8 @ 57.5 kg" when every set matches, otherwise "8, 8, 7 @ 57.5 kg". */
export function formatSets(sets: LoggedSet[]): string {
  if (!sets.length) return '';
  const weights = [...new Set(sets.map((s) => s.weight))];
  const w = weights.length === 1 && weights[0] !== null ? ` @ ${fmt(weights[0])} kg` : weights.some((x) => x !== null) ? ' (weights vary)' : '';
  const allSame = sets.every((s) => s.reps === sets[0].reps);
  return allSame ? `${sets.length} × ${sets[0].reps}${w}` : `${sets.map((s) => s.reps).join(', ')}${w}`;
}

/**
 * A plain double-progression rule: stay at a weight until every set reaches the top of the
 * rep range, then add the smallest sensible jump. General training guidance, not a prescription.
 */
export function suggestNext(exercise: GymExercise, last: LoggedSet[] | null): Suggestion {
  const top = exercise.repsHigh;
  const low = exercise.repsLow;
  if (!last || last.length === 0) {
    return {
      weight: null,
      text: exercise.kind === 'weight'
        ? `First time. Pick a weight you can lift for ${low}–${top} reps with 1–2 reps left in the tank.`
        : exercise.kind === 'band'
          ? 'First time. Pick a band that lets you finish every rep with control.'
          : 'First time. Go at a comfortable pace and keep every rep controlled.',
    };
  }

  const completedAllSets = last.length >= exercise.sets;
  const allAtTop = completedAllSets && last.every((s) => s.reps >= top);
  const anyBelowLow = last.some((s) => s.reps < low);

  if (exercise.kind === 'weight') {
    const weights = last.map((s) => s.weight).filter((w): w is number => w !== null);
    const w = weights.length ? Math.max(...weights) : null;
    if (w === null) return { weight: null, text: 'Log a weight this time so the next session can build on it.' };
    if (allAtTop) {
      const next = Math.round((w + exercise.step) * 10) / 10;
      return { weight: next, text: `You hit ${top} reps on every set at ${fmt(w)} kg. Try ${fmt(next)} kg.` };
    }
    if (anyBelowLow) {
      return { weight: w, text: `Stay at ${fmt(w)} kg and aim for ${low}+ reps on every set before adding weight.` };
    }
    return { weight: w, text: `Stay at ${fmt(w)} kg and aim for ${top} reps on every set.` };
  }

  if (exercise.kind === 'band') {
    return allAtTop
      ? { weight: null, text: 'Every set reached the top of the range. Use a stronger band, or slow the tempo.' }
      : { weight: null, text: `Same band. Aim for ${top} controlled reps on every set.` };
  }

  return allAtTop
    ? { weight: null, text: 'Every set reached the top of the range. Add a rep, slow the tempo, or make it harder.' }
    : { weight: null, text: `Aim for ${top} controlled reps on every set.` };
}
