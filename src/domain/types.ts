/** A value that can be dropped into a translated sentence. */
export type MsgParam =
  | string
  | number
  | Msg
  /** A number with a fixed number of decimals */
  | { n: number; d: number }
  /** A distance in metres, shown in the current unit; `unit: false` shows the number only */
  | { m: number; unit?: false }
  /** The current unit label: 'long' is m / yd, 'short' is m / ft */
  | { unit: 'long' | 'short' };

/** Language-neutral message: a dictionary key plus values. Translated only when shown. */
export interface Msg {
  k: string;
  p?: Record<string, MsgParam>;
}

export type TFn = (key: string, params?: Record<string, MsgParam>) => string;

export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'recovery' | 'green' | 'holed' | 'penalty';

export type SgCategory = 'tee' | 'approach' | 'short' | 'putting';

export const SG_LABEL: Record<SgCategory, string> = {
  tee: 'Off the tee',
  approach: 'Approach',
  short: 'Around green',
  putting: 'Putting',
};

export interface Profile {
  name: string;
  handicap: number;
  targetHandicap: number;
  practiceDaysPerWeek: number;
  practiceMinutesPerWeek: number;
  hasRange: boolean;
  hasPuttingGreen: boolean;
  hasShortGameArea: boolean;
  hasGym: boolean;
  gymDaysPerWeek: number;
  usesLaunchMonitor: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  handicap: 15,
  targetHandicap: 10,
  practiceDaysPerWeek: 3,
  practiceMinutesPerWeek: 240,
  hasRange: true,
  hasPuttingGreen: true,
  hasShortGameArea: true,
  hasGym: true,
  gymDaysPerWeek: 2,
  usesLaunchMonitor: false,
};

export interface Round {
  id: number;
  course: string;
  playedAt: string; // ISO date
  holes: number;
  parTotal: number;
  kind: 'practice' | 'competition';
}

export interface Shot {
  id: number;
  roundId: number;
  hole: number;
  par: number;
  shotNo: number;
  club: string;
  startLie: Lie;
  /** metres to the hole */
  startDist: number;
  endLie: Lie;
  /** metres to the hole; 0 when holed */
  endDist: number;
  penalty: number; // penalty strokes incurred by this shot
}

export interface DrillLog {
  id: number;
  drillId: string;
  category: SgCategory;
  loggedAt: string;
  attempts: number;
  successes: number;
  feeling: 1 | 2 | 3 | 4 | 5; // how it felt
  note: string;
}

/** Drill text lives in the translation files under drill.<id>.name / goal / step.N / rule. */
export interface Drill {
  id: string;
  category: SgCategory;
  minutes: number;
  needs: 'range' | 'putting' | 'short' | 'none';
  /** Number of instruction steps in the translation files */
  steps: number;
}

export interface PlannedSession {
  day: number; // 0 = Monday
  kind: 'practice' | 'gym' | 'round' | 'recovery';
  /** Only present on plans saved by older versions; titles are now built from kind and category */
  title?: string;
  minutes: number;
  category?: SgCategory;
  drillIds?: string[];
  gymTemplate?: 'strength' | 'power' | 'mobility';
}

export interface WeeklyPlan {
  createdAt: string;
  focus: SgCategory;
  allocation: Record<SgCategory, number>; // percentages summing to 100
  /** Messages; plans saved by older versions hold plain text instead */
  rationale: (Msg | string)[];
  sessions: PlannedSession[];
}
