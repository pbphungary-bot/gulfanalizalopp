// Basic performance statistics computed from saved shots. No sample data here.
import { data, shotsFor } from './store.js';

export function holeStats(round, hole) {
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
  return { shots, holed, strokes, putts, penalties, fairway, gir, toPar: holed ? strokes - hole.par : null };
}

export function roundStats(round) {
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
    penalties: sum((h) => h.penalties),
    fairways: fwHoles.filter((h) => h.fairway).length,
    fairwayChances: fwHoles.length,
    gir: done.filter((h) => h.gir).length,
    shotsLogged: holes.reduce((a, h) => a + h.shots.length, 0)
  };
}

// Aggregate over completed rounds, normalised to 18 holes so 9-hole rounds count fairly.
export function careerStats(limit = 10) {
  const rounds = data().rounds
    .filter((r) => r.status === 'complete')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
  const recent = rounds.slice(0, limit).map((r) => ({ round: r, s: roundStats(r) })).filter((x) => x.s.holesPlayed > 0);
  const holes = recent.reduce((a, x) => a + x.s.holesPlayed, 0);
  if (!holes) return { rounds: rounds.length, recent: 0 };
  const per18 = (f) => (recent.reduce((a, x) => a + f(x.s), 0) / holes) * 18;
  const pct = (num, den) => { const d = recent.reduce((a, x) => a + den(x.s), 0); return d ? (recent.reduce((a, x) => a + num(x.s), 0) / d) * 100 : null; };

  // Scoring by par type
  const byPar = {};
  for (const x of recent) for (const h of x.s.holes) if (h.holed) {
    const p = h.hole.par; byPar[p] = byPar[p] || { n: 0, toPar: 0 };
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
    scorePer18: per18((s) => s.strokes),
    toParPer18: per18((s) => s.toPar),
    puttsPer18: per18((s) => s.putts),
    penaltiesPer18: per18((s) => s.penalties),
    fairwayPct: pct((s) => s.fairways, (s) => s.fairwayChances),
    girPct: pct((s) => s.gir, (s) => s.holesPlayed),
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
  if (c.puttsPer18 > 33) candidates.push({ area: 'Putting', gap: (c.puttsPer18 - 31) / 3, text: `You average ${c.puttsPer18.toFixed(1)} putts per 18 holes. Lag putting and short putts are the quickest strokes to save.` });
  if (c.girPct != null && c.girPct < 40) candidates.push({ area: 'Approach', gap: (40 - c.girPct) / 10, text: `You hit ${c.girPct.toFixed(0)}% of greens in regulation. Approach play is where most of your strokes are likely going.` });
  if (c.fairwayPct != null && c.fairwayPct < 45) candidates.push({ area: 'Off the tee', gap: (45 - c.fairwayPct) / 12, text: `You hit ${c.fairwayPct.toFixed(0)}% of fairways. Tee-shot control would set up easier approaches.` });
  if (c.penaltiesPer18 > 1.5) candidates.push({ area: 'Course management', gap: c.penaltiesPer18 / 1.5, text: `You take ${c.penaltiesPer18.toFixed(1)} penalty strokes per 18 holes. Safer targets off the tee save shots immediately.` });
  candidates.sort((a, b) => b.gap - a.gap);
  return { stats: c, pick: candidates[0] || null };
}
