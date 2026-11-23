export const DISTANCE_CLUBS = [
  'Driver', '3W', '5W', 'Hybrid', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW',
];

export type DistanceSource = 'manual' | 'monitor';

export interface ClubDistance {
  id: number;
  club: string;
  /** Carry distance in metres */
  carry: number;
  /** Total distance in metres, if known */
  total: number | null;
  source: DistanceSource;
  /** Number of shots behind an average from a launch monitor, if known */
  shots: number | null;
  recordedAt: string; // ISO
  note: string;
}

export interface ClubSummary {
  club: string;
  latest: ClubDistance | null;
  previous: ClubDistance | null;
  /** Latest carry minus previous carry, in metres */
  delta: number | null;
}

/** Newest first. Ties on time fall back to insertion order. */
export function history(entries: ClubDistance[], club: string): ClubDistance[] {
  return entries
    .filter((e) => e.club === club)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id - a.id);
}

export function summarize(entries: ClubDistance[]): ClubSummary[] {
  return DISTANCE_CLUBS.map((club) => {
    const h = history(entries, club);
    const latest = h[0] ?? null;
    const previous = h[1] ?? null;
    return { club, latest, previous, delta: latest && previous ? latest.carry - previous.carry : null };
  });
}

export type GapFlag = 'order' | 'tight' | 'wide' | null;

export interface Gap {
  from: string;
  to: string;
  metres: number;
  /** Clubs between these two in the bag that have no recorded distance yet */
  skipped: number;
  flag: GapFlag;
}

/** Rule-of-thumb limits used only to point out gaps worth a look, never as equipment advice. */
export const TIGHT_GAP = 5; // metres
export const WIDE_GAP = 20; // metres

/**
 * Gaps between neighbouring recorded clubs, longest club first, using each club's latest carry.
 * Tight/wide flags only apply when the two clubs sit next to each other in the bag. If clubs
 * between them have no distance yet, the gap is shown but not judged.
 */
export function gaps(summaries: ClubSummary[]): Gap[] {
  const have = summaries
    .map((s, index) => ({ s, index }))
    .filter((x) => x.s.latest);
  const out: Gap[] = [];
  for (let i = 0; i + 1 < have.length; i++) {
    const a = have[i];
    const b = have[i + 1];
    const metres = a.s.latest!.carry - b.s.latest!.carry;
    const skipped = b.index - a.index - 1;
    const flag: GapFlag =
      metres <= 0 ? 'order'
        : skipped > 0 ? null
          : metres <= TIGHT_GAP ? 'tight'
            : metres > WIDE_GAP ? 'wide'
              : null;
    out.push({ from: a.s.club, to: b.s.club, metres, skipped, flag });
  }
  return out;
}

export const GAP_TEXT: Record<Exclude<GapFlag, null>, string> = {
  order: 'Longer club carries no further. Check the numbers.',
  tight: 'Very close. These two may overlap.',
  wide: 'Big gap. Worth knowing what you hit here.',
};
