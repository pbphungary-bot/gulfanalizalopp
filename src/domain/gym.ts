export type GymTemplateKey = 'strength' | 'power' | 'mobility';
export type LoadKind = 'weight' | 'band' | 'bodyweight';

export interface GymExercise {
  id: string;
  name: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  perSide: boolean;
  kind: LoadKind;
  /** Smallest sensible jump in kg when adding weight */
  step: number;
  /** Plain text for lists, e.g. "3 × 6–8" */
  prescription: string;
}

function ex(
  id: string, name: string, sets: number, repsLow: number, repsHigh: number,
  kind: LoadKind, step = 0, perSide = false,
): GymExercise {
  const reps = repsLow === repsHigh ? `${repsLow}` : `${repsLow}–${repsHigh}`;
  return { id, name, sets, repsLow, repsHigh, perSide, kind, step, prescription: `${sets} × ${reps}${perSide ? ' each side' : ''}` };
}

export const GYM_TEMPLATES: Record<GymTemplateKey, { title: string; note: string; exercises: GymExercise[] }> = {
  strength: {
    title: 'Golf strength',
    note: 'Lower body and trunk strength. Leave 1–2 reps in reserve.',
    exercises: [
      ex('squat', 'Goblet or back squat', 3, 6, 8, 'weight', 2.5),
      ex('rdl', 'Romanian deadlift', 3, 8, 10, 'weight', 2.5),
      ex('split-squat', 'Split squat', 3, 8, 10, 'weight', 2, true),
      ex('row', 'Single-arm row', 3, 10, 12, 'weight', 2, true),
      ex('pallof', 'Pallof press (anti-rotation)', 3, 10, 12, 'band', 0, true),
    ],
  },
  power: {
    title: 'Rotational power',
    note: 'Fast, crisp reps. Stop a set when speed drops.',
    exercises: [
      ex('mb-throw', 'Medicine ball rotational throw', 4, 5, 5, 'weight', 1, true),
      ex('box-jump', 'Box jump', 3, 4, 4, 'bodyweight'),
      ex('woodchop', 'Cable woodchop', 3, 8, 10, 'weight', 2.5, true),
      ex('landmine', 'Landmine rotation', 3, 6, 8, 'weight', 2.5, true),
    ],
  },
  mobility: {
    title: 'Mobility',
    note: 'Easy effort. Move through comfortable ranges only.',
    exercises: [
      ex('thoracic', 'Thoracic rotation (open book)', 2, 10, 10, 'bodyweight', 0, true),
      ex('hip-9090', '90/90 hip rotations', 2, 8, 8, 'bodyweight', 0, true),
      ex('shoulder-car', 'Shoulder CARs', 2, 5, 5, 'bodyweight', 0, true),
      ex('ankle-rocks', 'Ankle mobility rocks', 2, 10, 10, 'bodyweight', 0, true),
    ],
  },
};

export const GYM_SAFETY_NOTE =
  'This is general training guidance, not medical advice. If you have pain or an injury, stop and see a qualified professional.';
