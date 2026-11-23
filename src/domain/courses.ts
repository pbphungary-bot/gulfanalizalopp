import type { Msg } from './types';

export type Gender = 'men' | 'women';
export type TeeColor = 'white' | 'yellow' | 'blue' | 'red' | 'black' | 'green' | 'orange' | 'other';
export const TEE_COLORS: TeeColor[] = ['black', 'white', 'yellow', 'blue', 'green', 'red', 'orange', 'other'];

/** Course Rating and Slope Rating of one tee for one gender. */
export interface Rating {
  gender: Gender;
  cr: number;
  sr: number;
}

export interface Tee {
  id: string;
  color: TeeColor;
  ratings: Rating[];
  /** Length of each hole in metres, in hole order */
  lengths: number[];
}

export interface CourseHole {
  par: number;
  /** Stroke index (handicap hole number), 1 = hardest */
  si: number;
}

export interface Course {
  id: string;
  name: string;
  holes: CourseHole[];
  tees: Tee[];
  /** Shipped with the app, so it cannot be deleted */
  builtin?: boolean;
}

export const coursePar = (c: Pick<Course, 'holes'>) => c.holes.reduce((a, h) => a + h.par, 0);
export const teeLength = (t: Tee) => t.lengths.reduce((a, b) => a + b, 0);
export const ratingFor = (t: Tee, g: Gender): Rating | undefined => t.ratings.find((r) => r.gender === g);

/** WHS course handicap (estimate): index x slope / 113 + (CR - par), rounded. */
export function courseHandicap(index: number, r: Rating, par: number): number {
  return Math.round((index * r.sr) / 113 + (r.cr - par));
}

const err = (k: string, p?: Msg['p']): Msg => ({ k, p });

/** Checks a course before it is saved. An empty list means it is valid. */
export function validateCourse(c: Course): Msg[] {
  const out: Msg[] = [];
  if (!c.name.trim()) out.push(err('course.err.name'));
  const n = c.holes.length;
  if (n !== 9 && n !== 18) out.push(err('course.err.holes'));
  c.holes.forEach((h, i) => {
    if (![3, 4, 5, 6].includes(h.par)) out.push(err('course.err.par', { n: i + 1 }));
  });
  const si = c.holes.map((h) => h.si).sort((a, b) => a - b);
  if (si.some((v, i) => v !== i + 1)) out.push(err('course.err.si', { max: n }));
  if (!c.tees.length) out.push(err('course.err.noTee'));
  for (const t of c.tees) {
    if (t.lengths.length !== n || t.lengths.some((l) => !(l >= 20 && l <= 700))) out.push(err('course.err.lengths', { tee: { k: `tee.${t.color}` } }));
    if (!t.ratings.length) out.push(err('course.err.noRating', { tee: { k: `tee.${t.color}` } }));
    for (const r of t.ratings) {
      if (!(r.sr >= 55 && r.sr <= 155)) out.push(err('course.err.sr', { tee: { k: `tee.${t.color}` } }));
      if (!(r.cr >= 50 && r.cr <= 90)) out.push(err('course.err.cr', { tee: { k: `tee.${t.color}` } }));
    }
  }
  return out;
}

/* Built-in course. Ratings, stroke indexes and lengths as published by the club. */

const hencse = (id: string, color: TeeColor, ratings: Rating[], lengths: number[]): Tee => ({ id, color, ratings, lengths });

export const HENCSE: Course = {
  id: 'hencse-national',
  name: 'Hencse National Golf & Country Club',
  builtin: true,
  holes: [
    [5, 9], [4, 5], [4, 7], [4, 1], [3, 11], [5, 17], [4, 13], [4, 3], [3, 15],
    [4, 10], [4, 18], [3, 12], [4, 4], [5, 8], [4, 2], [5, 14], [3, 16], [4, 6],
  ].map(([par, si]) => ({ par, si })),
  tees: [
    hencse('white', 'white', [{ gender: 'men', cr: 73.5, sr: 136 }],
      [484, 308, 346, 371, 192, 469, 342, 384, 178, 406, 324, 178, 372, 504, 347, 443, 128, 430]),
    hencse('yellow', 'yellow', [{ gender: 'men', cr: 72.4, sr: 131 }],
      [473, 298, 334, 365, 157, 449, 334, 369, 167, 377, 314, 171, 355, 477, 337, 396, 105, 397]),
    hencse('blue', 'blue', [{ gender: 'men', cr: 71.2, sr: 128 }, { gender: 'women', cr: 76.7, sr: 130 }],
      [462, 288, 326, 358, 140, 443, 325, 362, 155, 369, 305, 164, 336, 472, 333, 356, 80, 390]),
    hencse('red', 'red', [{ gender: 'men', cr: 67.3, sr: 121 }, { gender: 'women', cr: 72.7, sr: 120 }],
      [407, 277, 295, 316, 135, 380, 287, 322, 134, 313, 282, 135, 312, 403, 268, 296, 73, 339]),
  ],
};

export const BUILTIN_COURSES: Course[] = [HENCSE];
