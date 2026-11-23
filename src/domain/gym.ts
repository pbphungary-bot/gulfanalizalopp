import type { TFn } from './types';

export type GymTemplateKey = 'strength' | 'power' | 'mobility';
export type LoadKind = 'weight' | 'band' | 'bodyweight';

/** Names live in the translation files under gym.ex.<id>; template titles under gym.tpl.<key>. */
export interface GymExercise {
  id: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  perSide: boolean;
  kind: LoadKind;
  /** Smallest sensible jump in kg when adding weight */
  step: number;
}

function ex(
  id: string, sets: number, repsLow: number, repsHigh: number,
  kind: LoadKind, step = 0, perSide = false,
): GymExercise {
  return { id, sets, repsLow, repsHigh, perSide, kind, step };
}

export const GYM_TEMPLATES: Record<GymTemplateKey, { exercises: GymExercise[] }> = {
  strength: {
    exercises: [
      ex('squat', 3, 6, 8, 'weight', 2.5),
      ex('rdl', 3, 8, 10, 'weight', 2.5),
      ex('split-squat', 3, 8, 10, 'weight', 2, true),
      ex('row', 3, 10, 12, 'weight', 2, true),
      ex('pallof', 3, 10, 12, 'band', 0, true),
    ],
  },
  power: {
    exercises: [
      ex('mb-throw', 4, 5, 5, 'weight', 1, true),
      ex('box-jump', 3, 4, 4, 'bodyweight'),
      ex('woodchop', 3, 8, 10, 'weight', 2.5, true),
      ex('landmine', 3, 6, 8, 'weight', 2.5, true),
    ],
  },
  mobility: {
    exercises: [
      ex('thoracic', 2, 10, 10, 'bodyweight', 0, true),
      ex('hip-9090', 2, 8, 8, 'bodyweight', 0, true),
      ex('shoulder-car', 2, 5, 5, 'bodyweight', 0, true),
      ex('ankle-rocks', 2, 10, 10, 'bodyweight', 0, true),
    ],
  },
};

/** "3 × 6–8", with "each side" where it applies. */
export function prescription(e: GymExercise, t: TFn): string {
  const reps = e.repsLow === e.repsHigh ? `${e.repsLow}` : `${e.repsLow}–${e.repsHigh}`;
  return `${e.sets} × ${reps}${e.perSide ? ` ${t('gym.eachSide')}` : ''}`;
}
