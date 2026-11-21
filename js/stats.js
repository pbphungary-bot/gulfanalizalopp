// Basic performance statistics computed from saved shots. No sample data here.
import { data, shotsFor } from './store.js';

export function holeStats(round, hole) {
  if (round.detail === 'holes' || round.detail === 'total') {
    const holed = round.detail === 'holes' && hole.score != null;
    return { shots: [], holed, strokes: holed ? hole.score : 0, putts: holed && hole.putts != null ? hole.putts : 0,
      puttsKnown: holed && hole.putts != null, penalties: 0, fairway: null, gir: null, toPar: holed ? hole.score - hole.par : null };
  }
  const shots = shotsFor(round.id, hole.n);
  const holed = shots.some((s) => s.endLie === 'holed');
  const penalties = shots.reduce((a, s) => a + (s.penalty || 0), 0);
  const strokes = shots.length + penalties;
  const putts = shots.filter((s) => s.startLie === 'green').length;
  const tee = shots[0];
  const fairway = hole.par >= 4 && tee ? tee.endLie === 'fairway' : null;
  // Green in regulation: on the green (or holed) within par - 2 strokes, penalties included.
  let gir = null;
  if (holed) {
    let count = 0; gir = false;
    for (const s of shots) {
      count += 1 + (s.penalty || 0);
      if ((s.endLie === 'green' || s.endLie === 'holed') && count <= hole.par - 2) { gir = true; break; }
    }
  }
  return { shots, holed, strokes, putts, puttsKnown: holed, penalties, fairway, gir, toPar: holed ? strokes - hole.par : null };
}

export function roundStats(round) {
  if (round.detail === 'total') {
    const n = round.holes.length;
    return { holes: round.holes.map((h) => ({ hole: h, ...holeStats(round, h) })), holesPlayed: n, complete: true,
      strokes: round.totalScore, par: round.parTotal, toPar: round.parTotal != null ? round.totalScore - round.parTotal : null,
      putts: round.totalPutts ?? null, puttsHoles: round.totalPutts != null ? n : 0, penalties: null,
      fairways: 0, fairwayChances: 0, gir: 0, girHoles: 0, shotsLogged: 0, perHole: false };
  }
  const holes = round.holes.map((h) => ({ hole: h, ...holeStats(round, h) }));
  const done = holes.filter((h) => h.holed);
  const sum = (f) => done.reduce((a, h) => a + f(h), 0);
  const fwHoles = done.filter((h) => h.fairway !== null);
  return {
    holes,
    holesPlayed: done.length,
    complete: done.length === round.holes.length,
    strokes: sum((h) => h.strokes),
    par: sum((h) => h.hole.par),
    toPar: sum((h) => h.toPar),
    putts: sum((h) => h.putts),
    puttsHoles: done.filter((h) => h.puttsKnown).length,
    penalties: round.detail === 'shots' ? sum((h) => h.penalties) : null,
    fairways: fwHoles.filter((h) => h.fairway).length,
    fairwayChances: fwHoles.length,
    gir: done.filter((h) => h.gir).length,
    girHoles: round.detail === 'shots' ? done.length : 0,
    perHole: true,
    shotsLogged: holes.reduce((a, h) => a + h.shots.length, 0)
  };
}

// Aggregate over completed rounds, normalised to 18 holes so 9-hole rounds count fairly.
export function careerStats(limit = 10) {
  const rounds = data().rounds
    .filter((r) => r.status === 'complete')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
  const recent = rounds.slice(0, limit).map((r) => ({ round: r, s: roundStats(r) })).filter((x) => x.s.holesPlayed >= 9); // partial rounds under 9 holes would distort per-18 rates
  const holes = recent.reduce((a, x) => a + x.s.holesPlayed, 0);
  if (!holes) return { rounds: rounds.length, recent: 0 };
  const sumOf = (f) => recent.reduce((a, x) => a + (f(x.s) || 0), 0);
  const rate18 = (num, den) => { const d = sumOf(den); return d ? (sumOf(num) / d) * 18 : null; };
  const pct = (num, den) => { const d = sumOf(den); return d ? (sumOf(num) / d) * 100 : null; };
  const per18 = (f) => (sumOf(f) / holes) * 18;
  const parKnown = recent.filter((x) => x.s.toPar != null);
  const parHoles = parKnown.reduce((a, x) => a + x.s.holesPlayed, 0);
  const shotRounds = recent.filter((x) => x.round.detail === 'shots');
  const shotHoles = shotRounds.reduce((a, x) => a + x.s.holesPlayed, 0);

  // Scoring by par type
  const byPar = {};
  for (const x of recent) for (const h of x.s.holes) if (h.holed) {
    const p = h.hole.par; if (!p) continue; byPar[p] = byPar[p] || { n: 0, toPar: 0 };
    byPar[p].n++; byPar[p].toPar += h.toPar;
  }
  // Putts by first-putt distance
  const bands = [[0, 6, '0–6 ft'], [6, 15, '6–15 ft'], [15, 30, '15–30 ft'], [30, 1e9, '30+ ft']];
  const putting = bands.map(([lo, hi, label]) => ({ label, n: 0, putts: 0 }));
  for (const x of recent) for (const h of x.s.holes) if (h.holed) {
    const first = h.shots.find((s) => s.startLie === 'green');
    if (!first) continue;
    const i = bands.findIndex(([lo, hi]) => first.startDist >= lo && first.startDist < hi);
    if (i >= 0) { putting[i].n++; putting[i].putts += h.putts; }
  }

  return {
    rounds: rounds.length,
    recent: recent.length,
    holes,
    shotRounds: shotRounds.length,
    scorePer18: per18((s) => s.strokes),
    toParPer18: parHoles ? (parKnown.reduce((a, x) => a + x.s.toPar, 0) / parHoles) * 18 : null,
    puttsPer18: rate18((s) => s.putts, (s) => s.puttsHoles),
    penaltiesPer18: shotHoles ? (shotRounds.reduce((a, x) => a + x.s.penalties, 0) / shotHoles) * 18 : null,
    fairwayPct: pct((s) => s.fairways, (s) => s.fairwayChances),
    girPct: pct((s) => s.gir, (s) => s.girHoles),
    trend: recent.slice().reverse().map((x) => ({ date: x.round.date, per18: (x.s.strokes / x.s.holesPlayed) * 18, holes: x.s.holesPlayed, competition: !!x.round.competition })),
    byPar,
    putting,
    lastRound: recent[0]
  };
}

// A simple, transparent rule for the Home "next step" card until strokes gained lands.
export function nextStep() {
  const c = careerStats();
  if (!c.recent) return null;
  const candidates = [];
  if (c.puttsPer18 != null && c.puttsPer18 > 33) candidates.push({ area: 'Putting', gap: (c.puttsPer18 - 31) / 3, text: `You average ${c.puttsPer18.toFixed(1)} putts per 18 holes. Lag putting and short putts are the quickest strokes to save.` });
  if (c.girPct != null && c.girPct < 40) candidates.push({ area: 'Approach', gap: (40 - c.girPct) / 10, text: `You hit ${c.girPct.toFixed(0)}% of greens in regulation. Approach play is where most of your strokes are likely going.` });
  if (c.fairwayPct != null && c.fairwayPct < 45) candidates.push({ area: 'Off the tee', gap: (45 - c.fairwayPct) / 12, text: `You hit ${c.fairwayPct.toFixed(0)}% of fairways. Tee-shot control would set up easier approaches.` });
  if (c.penaltiesPer18 != null && c.penaltiesPer18 > 1.5) candidates.push({ area: 'Course management', gap: c.penaltiesPer18 / 1.5, text: `You take ${c.penaltiesPer18.toFixed(1)} penalty strokes per 18 holes. Safer targets off the tee save shots immediately.` });
  candidates.sort((a, b) => b.gap - a.gap);
  return { stats: c, pick: candidates[0] || null };
}

// ---- Launch monitor ----
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

export function launchClubs() {
  const d = data();
  const counts = {};
  for (const s of d.launchShots) if (s.club) counts[s.club] = (counts[s.club] || 0) + 1;
  return counts;
}

// days: number of days back from today, or null for all time. offsetDays shifts the window back (for "previous period").
export function launchClubStats(club, days = null, offsetDays = 0) {
  const d = data();
  const sess = new Map(d.launchSessions.map((s) => [s.id, s]));
  const now = Date.now();
  const shots = d.launchShots.filter((s) => {
    if (s.club !== club) return false;
    if (days == null) return true;
    const date = sess.get(s.sessionId)?.date;
    if (!date) return false;
    const age = (now - new Date(date + 'T12:00:00').getTime()) / 864e5;
    return age >= offsetDays && age < offsetDays + days;
  });
  const col = (k) => shots.map((s) => s[k]).filter((v) => typeof v === 'number' && !isNaN(v));
  const carry = col('carry');
  const metric = (k) => { const v = col(k); return { n: v.length, avg: mean(v), median: median(v), sd: sd(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null }; };
  return {
    n: shots.length,
    carry: metric('carry'), total: metric('total'), clubSpeed: metric('clubSpeed'), ballSpeed: metric('ballSpeed'),
    smash: metric('smash'), launch: metric('launch'), backspin: metric('backspin'), sidespin: metric('sidespin'),
    apex: metric('apex'), toTarget: metric('toTarget'),
    signed: shots.length > 0 && shots.every((s) => s.signed),
    carrySpread: carry.length >= 3 ? [quantile(carry, 0.1), quantile(carry, 0.9)] : null
  };
}

function quantile(a, q) {
  const b = a.slice().sort((x, y) => x - y);
  const pos = (b.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return b[lo] + (b[hi] - b[lo]) * (pos - lo);
}
