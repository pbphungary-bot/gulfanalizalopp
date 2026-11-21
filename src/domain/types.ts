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
  /** yards to hole, or feet when startLie === 'green' */
  startDist: number;
  endLie: Lie;
  /** yards to hole, or feet when endLie === 'green'; 0 when holed */
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

export interface Drill {
  id: string;
  name: string;
  category: SgCategory;
  minutes: number;
  needs: 'range' | 'putting' | 'short' | 'none';
  goal: string;
  steps: string[];
  /** Describes what counts as one success so results are comparable */
  successRule: string;
}

export interface PlannedSession {
  day: number; // 0 = Monday
  kind: 'practice' | 'gym' | 'round' | 'recovery';
  title: string;
  minutes: number;
  category?: SgCategory;
  drillIds?: string[];
  gymTemplate?: 'strength' | 'power' | 'mobility';
}

export interface WeeklyPlan {
  createdAt: string;
  focus: SgCategory;
  allocation: Record<SgCategory, number>; // percentages summing to 100
  rationale: string[];
  sessions: PlannedSession[];
}
