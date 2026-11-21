export interface GymExercise { name: string; prescription: string }

export const GYM_TEMPLATES: Record<'strength' | 'power' | 'mobility', { title: string; note: string; exercises: GymExercise[] }> = {
  strength: {
    title: 'Golf strength',
    note: 'Lower body and trunk strength. Leave 1–2 reps in reserve.',
    exercises: [
      { name: 'Goblet or back squat', prescription: '3 × 6–8' },
      { name: 'Romanian deadlift', prescription: '3 × 8' },
      { name: 'Split squat', prescription: '3 × 8 each side' },
      { name: 'Single-arm row', prescription: '3 × 10 each side' },
      { name: 'Pallof press (anti-rotation)', prescription: '3 × 10 each side' },
    ],
  },
  power: {
    title: 'Rotational power',
    note: 'Fast, crisp reps. Stop a set when speed drops.',
    exercises: [
      { name: 'Medicine ball rotational throw', prescription: '4 × 5 each side' },
      { name: 'Box jump', prescription: '3 × 4' },
      { name: 'Cable woodchop', prescription: '3 × 8 each side' },
      { name: 'Landmine rotation', prescription: '3 × 6 each side' },
    ],
  },
  mobility: {
    title: 'Mobility',
    note: 'Easy effort. Move through comfortable ranges only.',
    exercises: [
      { name: 'Thoracic rotation (open book)', prescription: '2 × 10 each side' },
      { name: '90/90 hip rotations', prescription: '2 × 8 each side' },
      { name: 'Shoulder CARs', prescription: '2 × 5 each side' },
      { name: 'Ankle mobility rocks', prescription: '2 × 10 each side' },
    ],
  },
};

export const GYM_SAFETY_NOTE =
  'This is general training guidance, not medical advice. If you have pain or an injury, stop and see a qualified professional.';
