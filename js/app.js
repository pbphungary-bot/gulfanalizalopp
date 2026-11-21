import * as store from './store.js';
import { CLUBS } from './store.js';
import { holeStats, roundStats, careerStats, nextStep, launchClubs, launchClubStats } from './stats.js';
import { readTable, parseLaunch, parseRounds, groupLaunch, ROUNDS_TEMPLATE } from './importer.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYNAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FINISH = ['fairway', 'rough', 'sand', 'recovery', 'green', 'holed'];
const DEMO = '<span class="demo">DEMO · SAMPLE DATA</span>';
const LIVE = '<span class="live">YOUR DATA</span>';
const fmtToPar = (v) => (v === 0 ? 'E' : (v > 0 ? '+' : '') + v);
const fmt1 = (v) => (v == null || isNaN(v) ? '–' : v.toFixed(1));
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };

// ---------- UI state (not persisted) ----------
const ui = {
  tab: 'home',
  hole: null,          // current hole number in the active round
  draft: null,         // shot being entered
  viewRound: null,     // round id shown in detail
  msg: '',
  profileErr: '',
  confirm: null,       // inline confirmation in place of browser dialogs
  pendingImport: null,
  editYards: false,
  perfView: null,      // 'past' | 'import' | null
  past: null,
  imp: null,
  importErr: '',
  lmClub: null,
  lmPeriod: null
};

// ---------- Shot helpers ----------
function suggestClub(lie, dist, par) {
  if (lie === 'green') return 'Putter';
  if (lie === 'tee' && par >= 4) return 'Driver';
  const table = [[215, '3W'], [195, '5W'], [180, 'Hybrid'], [170, '5i'], [160, '6i'], [150, '7i'], [140, '8i'], [130, '9i'], [115, 'PW'], [100, 'GW'], [45, 'SW']];
  for (const [min, c] of table) if (dist >= min) return c;
  return 'LW';
}

function startOf(round, hole) {
  const shots = store.shotsFor(round.id, hole.n);
  const last = shots[shots.length - 1];
  if (!last) return { lie: 'tee', dist: hole.yards, seq: 1 };
  return { lie: last.endLie, dist: last.endDist, seq: shots.length + 1 };
}

function freshDraft(round, hole) {
  const st = startOf(round, hole);
  return { club: suggestClub(st.lie, st.dist || 0, hole.par), endLie: null, endDist: '', penalty: 0 };
}

function unitFor(lie) { return lie === 'green' ? 'ft' : 'yd'; }
function distLabel(lie, dist) { return dist == null || dist === '' ? '' : `${dist} ${unitFor(lie)}`; }

// ---------- Rendering ----------
function render() {
  const d = store.data();
  const onboarding = !d.player;
  $('#tabbar').hidden = onboarding;
  const name = onboarding ? 'profile' : ui.tab;
  ['home', 'coach', 'play', 'perf', 'profile'].forEach((n) => { $('#s-' + n).hidden = n !== name; });
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === ui.tab)));
  ({ home: renderHome, coach: renderCoach, play: renderPlay, perf: renderPerf, profile: renderProfile })[name]();
}

function go(tab) {
  ui.tab = tab; ui.msg = ''; ui.confirm = null; ui.editYards = false;
  if (tab !== 'perf') { ui.viewRound = null; ui.perfView = null; }
  ui.importErr = '';
  render();
  $('#screens').scrollTop = 0;
}

// ----- Home -----
function renderHome() {
  const p = store.data().player;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const c = careerStats();
  const active = store.activeRound();
  const ns = nextStep();

  let next;
  if (active) {
    const s = roundStats(active);
    next = { msg: `You have a round in progress at ${esc(active.courseName)}: ${s.holesPlayed} of ${active.holes.length} holes recorded.`, cta: 'RESUME ROUND', go: 'play' };
  } else if (!c.recent) {
    next = { msg: 'Record your first round shot by shot. Every insight and plan in this app is built from the shots you save.', cta: 'START A ROUND', go: 'play' };
  } else if (ns.pick) {
    next = { area: ns.pick.area, msg: esc(ns.pick.text), cta: 'RECORD ANOTHER ROUND', go: 'play' };
  } else {
    next = { msg: `No clear weakness yet across ${c.recent} round${c.recent > 1 ? 's' : ''}. Keep recording rounds so the coach can find where strokes go.`, cta: 'START A ROUND', go: 'play' };
  }

  $('#s-home').innerHTML = `
    <div class="row head">
      <div>
        <span class="eyebrow accent">${greet}, ${esc(p.name.split(' ')[0])}</span>
        <h1>Your game. Decoded.</h1>
        <p class="muted">${p.targetHandicap != null ? `Your journey to a ${p.targetHandicap.toFixed(1)} handicap continues.` : 'Set a target handicap in your profile.'}</p>
      </div>
      <button class="iconbtn" type="button" data-action="profile" aria-label="Edit profile">⚙</button>
    </div>

    <div class="card coach next">
      <span class="eyebrow accent">Your next step${next.area ? ' · ' + esc(next.area) : ''}</span>
      <p class="msg">${next.msg}</p>
      ${c.recent ? `<p class="muted" style="font-size:13px">Based on ${c.holes} holes from your last ${c.recent} round${c.recent > 1 ? 's' : ''}. Strokes-gained analysis and training sessions arrive in the next milestones.</p>` : ''}
      <div class="btns"><button class="btn" type="button" data-go="${next.go}">${next.cta}</button></div>
    </div>

    <div class="stats">
      <div class="card stat"><span class="eyebrow">Handicap</span><span class="v">${fmt1(p.handicap)}</span><span class="n">${p.targetHandicap != null ? 'Target ' + p.targetHandicap.toFixed(1) : 'From your profile'}</span></div>
      <div class="card stat"><span class="eyebrow">Avg. score</span><span class="v">${c.recent ? fmt1(c.scorePer18) : '–'}</span><span class="n">${c.recent ? `Per 18, last ${c.recent} round${c.recent > 1 ? 's' : ''}` : 'No rounds yet'}</span></div>
      <div class="card stat"><span class="eyebrow">Putts</span><span class="v">${c.recent ? fmt1(c.puttsPer18) : '–'}</span><span class="n">Per 18 holes</span></div>
      <div class="card stat"><span class="eyebrow">Greens</span><span class="v">${c.recent && c.girPct != null ? c.girPct.toFixed(0) + '%' : '–'}</span><span class="n">In regulation</span></div>
    </div>

    <div class="card dim">
      <div class="row between"><span class="eyebrow">This week</span>${DEMO}</div>
      <p class="muted" style="font-size:14px">Your adaptive weekly plan arrives in milestone 4. It will be built from your rounds and practice, around your ${p.preferredPlayDay != null ? DAYNAMES[p.preferredPlayDay] : 'chosen'} play day.</p>
    </div>`;
}

// ----- Coach (still a demo) -----
function renderCoach() {
  const PLAN = [
    [0, 'Approach practice', 60], [1, 'Gym: Golf strength', 45], [2, 'Around green practice', 45],
    [3, 'Approach practice', 45], [4, 'Light mobility before round day', 20], [5, 'Play a round and track every shot', 240]
  ];
  $('#s-coach').innerHTML = `
    <h1>My Coach</h1>
    <div class="card coach">
      ${DEMO}
      <p>This screen is still the design preview. Once enough rounds are recorded, the plan below will be generated from your strokes-gained weaknesses, the time you have and your play day, and will adapt to your drill results.</p>
    </div>
    <div class="card dim">
      <h2>Why this plan</h2>
      <ul class="why">
        <li>Approach is costing you the most: -2.1 strokes per round.</li>
        <li>Putting is a strength. Don’t over-practice it.</li>
      </ul>
    </div>
    ${PLAN.map(([d, t, m]) => `<div class="card dim"><div class="row plan"><span class="d">${DAYNAMES[d]}</span><span class="t">${t}</span><span class="m">${m} min</span></div></div>`).join('')}`;
}

// ----- Play -----
function renderPlay() {
  const r = store.activeRound();
  if (!r) return renderStartRound();
  if (ui.hole == null || !r.holes.find((h) => h.n === ui.hole)) {
    const firstOpen = r.holes.find((h) => !holeStats(r, h).holed);
    ui.hole = firstOpen ? firstOpen.n : r.holes[r.holes.length - 1].n;
  }
  const hole = r.holes.find((h) => h.n === ui.hole);
  const hs = holeStats(r, hole);
  const rs = roundStats(r);
  if (!ui.draft || ui.draft.hole !== hole.n || ui.draft.seq !== hs.shots.length + 1) {
    ui.draft = { ...freshDraft(r, hole), hole: hole.n, seq: hs.shots.length + 1 };
  }
  const st = startOf(r, hole);
  const dr = ui.draft;
  const needYards = st.seq === 1 && !hole.yards;

  const holeStrip = `<div class="holes">${r.holes.map((h) => {
    const s = holeStats(r, h);
    return `<button type="button" class="hole${h.n === hole.n ? ' cur' : ''}${s.holed ? ' done' : ''}" data-action="hole" data-n="${h.n}" aria-label="Hole ${h.n}${s.holed ? ', ' + s.strokes + ' strokes' : ''}">${h.n}<small>${s.holed ? s.strokes : s.shots.length ? '…' : '·'}</small></button>`;
  }).join('')}</div>`;

  const shotList = hs.shots.length ? `<ol class="shotlist">${hs.shots.map((s) => `
      <li><span class="n">${s.seq}</span><span class="t">${esc(s.club)} · ${esc(s.startLie)} ${distLabel(s.startLie, s.startDist)} → ${s.endLie === 'holed' ? '<b>holed</b>' : esc(s.endLie) + ' ' + distLabel(s.endLie, s.endDist)}${s.penalty ? ` <span class="neg">+${s.penalty} pen</span>` : ''}</span></li>`).join('')}</ol>` : '<p class="muted" style="font-size:14px">No shots yet on this hole.</p>';

  let entry;
  if (hs.holed) {
    const nextOpen = r.holes.find((h) => h.n > hole.n && !holeStats(r, h).holed) || r.holes.find((h) => !holeStats(r, h).holed);
    entry = `
      <div class="card">
        <h2>Hole ${hole.n} done: ${hs.strokes} (${fmtToPar(hs.toPar)})</h2>
        <p class="muted" style="font-size:14px">${hs.putts} putt${hs.putts === 1 ? '' : 's'}${hs.penalties ? ` · ${hs.penalties} penalty` : ''}${hs.gir ? ' · green in regulation' : ''}</p>
        <div class="btns">
          ${nextOpen ? `<button class="btn" type="button" data-action="hole" data-n="${nextOpen.n}">NEXT: HOLE ${nextOpen.n}</button>` : `<button class="btn" type="button" data-action="finish">FINISH ROUND</button>`}
          <button class="btn sec small" type="button" data-action="undo">UNDO LAST</button>
        </div>
      </div>`;
  } else {
    const endUnit = unitFor(dr.endLie);
    entry = `
      <div class="card">
        <h2>Shot ${st.seq} · from ${esc(st.lie)}${st.dist ? ' · ' + distLabel(st.lie, st.dist) : ''}</h2>
        ${needYards ? `<div class="field"><label class="label" for="yards">Hole length (yards)</label><input class="input" id="yards" inputmode="numeric" placeholder="e.g. 385" value="${esc(dr.yards || '')}"></div>` : ''}
        <span class="label">Club</span>
        <div class="chips">${CLUBS.map((c) => `<button type="button" class="chip" data-action="club" data-v="${c}" aria-pressed="${dr.club === c}">${c}</button>`).join('')}</div>
        <span class="label">Where did it finish?</span>
        <div class="chips">${FINISH.map((f) => `<button type="button" class="chip" data-action="finishlie" data-v="${f}" aria-pressed="${dr.endLie === f}">${f}</button>`).join('')}</div>
        ${dr.endLie && dr.endLie !== 'holed' ? `<div class="field"><label class="label" for="dist">Distance to hole (${endUnit === 'ft' ? 'feet' : 'yards'})</label><input class="input" id="dist" inputmode="numeric" value="${esc(dr.endDist)}" placeholder="${endUnit === 'ft' ? 'e.g. 12' : 'e.g. 150'}"></div>` : ''}
        <span class="label">Penalty strokes</span>
        <div class="chips">${[0, 1, 2].map((n) => `<button type="button" class="chip" data-action="pen" data-v="${n}" aria-pressed="${dr.penalty === n}">${n}</button>`).join('')}</div>
        <button class="btn" type="button" data-action="save">SAVE SHOT</button>
        <p class="err" id="shoterr" aria-live="polite">${esc(ui.msg)}</p>
        ${hs.shots.length ? '<button class="linkbtn" type="button" data-action="undo">Undo last shot</button>' : ''}
      </div>`;
  }

  $('#s-play').innerHTML = `
    <div class="row between">
      <h1>Hole ${hole.n}</h1>
      <span class="muted" style="font-size:14px;text-align:right">${esc(r.courseName)}<br>${rs.strokes} strokes · ${rs.holesPlayed ? fmtToPar(rs.toPar) : 'E'} thru ${rs.holesPlayed}</span>
    </div>
    <div class="card">
      <div class="row between">
        <span class="label">Par</span>
        <div class="chips">${[3, 4, 5].map((p) => `<button type="button" class="chip" data-action="par" data-v="${p}" aria-pressed="${hole.par === p}">${p}</button>`).join('')}</div>
      </div>
      ${ui.editYards ? `<div class="row between"><input class="input" id="edityards" inputmode="numeric" value="${hole.yards || ''}" aria-label="Hole length in yards" style="flex:1"><button class="btn small" type="button" data-action="saveyards">SAVE</button></div>`
        : `<div class="row between"><span class="label">Length</span><span>${hole.yards ? hole.yards + ' yd' : '<span class="muted">set on tee shot</span>'} ${hole.yards ? '<button class="linkbtn" type="button" data-action="edityards" style="padding:0 0 0 8px">edit</button>' : ''}</span></div>`}
      ${shotList}
    </div>
    ${entry}
    <div class="card">
      ${holeStrip}
      ${ui.confirm === 'finish' ? `<p>Only ${rs.holesPlayed} of ${r.holes.length} holes are finished. ${rs.shotsLogged ? 'Finish the round anyway?' : 'No shots are recorded, so the round will be discarded.'}</p>
        <div class="btns"><button class="btn" type="button" data-action="finishyes">${rs.shotsLogged ? 'YES, FINISH' : 'DISCARD ROUND'}</button><button class="btn sec" type="button" data-action="cancel">KEEP PLAYING</button></div>`
      : `<div class="btns"><button class="btn sec" type="button" data-action="finish">FINISH ROUND</button></div>`}
    </div>
    <p class="muted" style="font-size:13px">${LIVE} Every shot is saved on this device as soon as you tap Save. Back it up from My Game.</p>`;
}

function renderStartRound() {
  const d = store.data();
  const courses = d.courses.map((c) => c.name);
  const lastCourse = d.player.homeCourse || courses[0] || '';
  $('#s-play').innerHTML = `
    <h1>New round</h1>
    <div class="card">
      <div class="field"><label class="label" for="course">Course</label>
        <input class="input" id="course" list="courselist" value="${esc(lastCourse)}" placeholder="Course name" autocomplete="off">
        <datalist id="courselist">${courses.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      </div>
      <div class="grid2">
        <div class="field"><label class="label" for="rdate">Date</label><input class="input" id="rdate" type="date" value="${todayISO()}"></div>
        <div class="field"><span class="label">Holes</span><div class="chips" id="holecount">
          <button type="button" class="chip" data-hc="9" aria-pressed="false">9</button>
          <button type="button" class="chip" data-hc="18" aria-pressed="true">18</button></div></div>
      </div>
      <p class="muted" style="font-size:13px">Par and length are asked hole by hole and remembered for this course next time.</p>
      <button class="btn" type="button" data-action="start">START ROUND</button>
      <p class="err" aria-live="polite">${esc(ui.msg)}</p>
    </div>
    <p class="muted" style="font-size:14px">Most shots take three taps: club, finish, distance. The start of each shot carries over from the last one.</p>`;
}

// ----- My Game -----
const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v2">${v}</span></div>`;
const signed1 = (v) => (v == null ? '–' : (v >= 0 ? '+' : '') + v.toFixed(1));
const SOURCE = { app: 'Recorded shot by shot', manual: 'Entered by hand', file: 'Imported from file' };

function renderPerf() {
  if (ui.perfView === 'past') return renderPastForm();
  if (ui.perfView === 'import') return renderImportReview();
  if (ui.viewRound) return renderRoundDetail(ui.viewRound);
  const d = store.data();
  const c = careerStats();
  const rounds = d.rounds.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));

  const trend = c.recent > 1 ? `<div class="trend" role="img" aria-label="Scores per 18 holes, oldest to newest">${(() => {
    const vals = c.trend.map((t) => t.per18); const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
    return c.trend.map((t) => `<span title="${fmtDate(t.date)}: ${t.per18.toFixed(0)}" style="height:${12 + ((t.per18 - lo) / (hi - lo)) * 60}px" class="${t.competition ? 'comp' : ''}"><i>${t.per18.toFixed(0)}</i></span>`).join('');
  })()}</div><p class="legend">Oldest to newest, per 18 holes${c.trend.some((t) => t.competition) ? ' · lime = competition' : ''}</p>` : '';

  const statsCard = c.recent ? `
    <div class="card">
      <div class="row between"><h2>Last ${c.recent} round${c.recent > 1 ? 's' : ''}</h2>${LIVE}</div>
      <p class="muted" style="font-size:12px">${c.holes} holes, normalised to 18. ${c.shotRounds < c.recent ? `Fairways, greens and penalties come from the ${c.shotRounds} round${c.shotRounds === 1 ? '' : 's'} recorded shot by shot.` : ''}</p>
      ${trend}
      ${kv('Score per 18', fmt1(c.scorePer18) + (c.toParPer18 != null ? ` (${signed1(c.toParPer18)})` : ''))}
      ${kv('Putts per 18', fmt1(c.puttsPer18))}
      ${kv('Fairways hit', c.fairwayPct != null ? c.fairwayPct.toFixed(0) + '%' : '–')}
      ${kv('Greens in regulation', c.girPct != null ? c.girPct.toFixed(0) + '%' : '–')}
      ${kv('Penalty strokes per 18', fmt1(c.penaltiesPer18))}
    </div>
    ${Object.keys(c.byPar).length ? `<div class="card">
      <h2>Scoring by par</h2>
      ${[3, 4, 5].filter((p) => c.byPar[p]).map((p) => kv(`Par ${p} <span class="muted" style="font-size:12px">(${c.byPar[p].n} holes)</span>`, (c.byPar[p].toPar / c.byPar[p].n >= 0 ? '+' : '') + (c.byPar[p].toPar / c.byPar[p].n).toFixed(2))).join('')}
    </div>` : ''}
    ${c.putting.some((b) => b.n) ? `<div class="card">
      <h2>Putts by first-putt distance</h2>
      ${c.putting.filter((b) => b.n).map((b) => kv(`${b.label} <span class="muted" style="font-size:12px">(${b.n})</span>`, (b.putts / b.n).toFixed(2))).join('')}
    </div>` : ''}` : `
    <div class="card"><h2>No completed rounds yet</h2><p class="muted">Record a round on the Play tab, or add your earlier scores below so you don't start from scratch.</p>
      <div class="btns"><button class="btn" type="button" data-go="play">START A ROUND</button></div></div>`;

  $('#s-perf').innerHTML = `
    <h1>My game</h1>
    ${statsCard}
    <div class="card">
      <h2>Add earlier golf</h2>
      <p class="muted" style="font-size:14px">Enter past scores by hand, or import a CSV or Excel file of rounds or launch monitor shots.</p>
      <div class="btns">
        <button class="btn small" type="button" data-action="pastnew">ADD PAST SCORE</button>
        <label class="btn sec small" style="display:flex;align-items:center;justify-content:center">IMPORT FILE<input type="file" accept=".csv,.xlsx,.xlsm,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" id="datafile" hidden></label>
      </div>
      <button class="linkbtn" type="button" data-action="template">Download a rounds template (CSV)</button>
      <p class="err" aria-live="polite">${esc(ui.importErr || '')}</p>
    </div>
    ${renderLaunchCard()}
    <div class="card">
      <h2>Rounds</h2>
      ${rounds.length ? rounds.map((r) => { const s = roundStats(r); return `
        <button class="roundrow" type="button" data-action="viewround" data-id="${r.id}">
          <span><b>${esc(r.courseName)}</b>${r.competition ? ' <span class="tag">COMP</span>' : ''}<br><span class="muted" style="font-size:13px">${fmtDate(r.date)} · ${r.detail === 'total' ? r.holes.length + ' holes · score only' : `${s.holesPlayed}/${r.holes.length} holes`}${r.status === 'in_progress' ? ' · in progress' : ''}${r.source !== 'app' ? ' · ' + (r.source === 'file' ? 'imported' : 'entered') : ''}</span></span>
          <span class="s">${s.holesPlayed ? s.strokes : '–'}<span class="muted" style="font-size:13px;font-weight:600"> ${s.holesPlayed && s.toPar != null ? fmtToPar(s.toPar) : ''}</span></span>
        </button>`; }).join('') : '<p class="muted" style="font-size:14px">Nothing recorded yet.</p>'}
    </div>
    <div class="card dim">
      <div class="row between"><h2>Strokes gained</h2>${DEMO}</div>
      <p class="muted" style="font-size:14px">A later milestone turns rounds recorded shot by shot into strokes gained for off the tee, approach, around the green and putting.</p>
    </div>
    <div class="card">
      <h2>Your data</h2>
      <p class="muted" style="font-size:14px">${d.rounds.length} rounds, ${d.shots.length} course shots and ${d.launchShots.length} launch monitor shots are stored on this device. Download a backup now and then, especially before clearing browser data.</p>
      <div class="btns">
        <button class="btn sec small" type="button" data-action="export">DOWNLOAD BACKUP</button>
        <label class="btn sec small" style="display:flex;align-items:center;justify-content:center">RESTORE<input type="file" accept="application/json,.json" id="importfile" hidden></label>
      </div>
      ${ui.pendingImport ? `<p>This backup has ${ui.pendingImport.rounds} rounds and ${ui.pendingImport.shots} shots. Restoring replaces everything on this device.</p>
        <div class="btns"><button class="btn" type="button" data-action="importyes">REPLACE MY DATA</button><button class="btn sec" type="button" data-action="importno">CANCEL</button></div>` : ''}
      <p class="toast" aria-live="polite">${esc(ui.msg)}</p>
    </div>`;
}

// ----- Launch monitor per-club view -----
function renderLaunchCard() {
  const clubs = launchClubs();
  const names = CLUBS.filter((c) => clubs[c]);
  if (!names.length) return '';
  if (!ui.lmClub || !clubs[ui.lmClub]) ui.lmClub = names[0];
  const period = ui.lmPeriod ?? null;
  const st = launchClubStats(ui.lmClub, period);
  const prev = period ? launchClubStats(ui.lmClub, period, period) : null;
  const m = (label, x, unit, dp = 1, key) => {
    if (!x.n) return '';
    const p = prev && prev[key] && prev[key].n ? prev[key].avg : null;
    const delta = p != null ? ` <span class="muted" style="font-size:12px">(${signed1(x.avg - p)} vs previous)</span>` : '';
    return kv(label, `${x.avg.toFixed(dp)} ${unit}${delta}`);
  };
  const sessions = store.data().launchSessions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
    <div class="card">
      <div class="row between"><h2>Launch monitor</h2>${LIVE}</div>
      <div class="chips">${names.map((c) => `<button type="button" class="chip" data-action="lmclub" data-v="${c}" aria-pressed="${c === ui.lmClub}">${c} <small class="muted">${clubs[c]}</small></button>`).join('')}</div>
      <div class="chips">${[[30, 'Last 30 days'], [90, 'Last 90 days'], [null, 'All time']].map(([v, l]) => `<button type="button" class="chip" data-action="lmperiod" data-v="${v ?? ''}" aria-pressed="${period === v}">${l}</button>`).join('')}</div>
      ${st.n ? `
        <div class="stats">
          <div class="card stat"><span class="eyebrow">Carry</span><span class="v">${st.carry.median.toFixed(0)} m</span><span class="n">median · avg ${st.carry.avg.toFixed(1)}</span></div>
          <div class="card stat"><span class="eyebrow">Spread</span><span class="v">${st.carrySpread ? (st.carrySpread[1] - st.carrySpread[0]).toFixed(0) + ' m' : '–'}</span><span class="n">${st.carrySpread ? `80% land ${st.carrySpread[0].toFixed(0)}–${st.carrySpread[1].toFixed(0)} m` : 'needs 3+ shots'}</span></div>
        </div>
        <p class="muted" style="font-size:13px">${st.n} shots${period ? ' in this period' : ''}.${prev && prev.n ? ` Previous ${period} days: ${prev.n} shots.` : ''}</p>
        ${m('Total', st.total, 'm', 1, 'total')}
        ${m('Club speed', st.clubSpeed, 'mph', 1, 'clubSpeed')}
        ${m('Ball speed', st.ballSpeed, 'mph', 1, 'ballSpeed')}
        ${m('Smash factor', st.smash, '', 2, 'smash')}
        ${m('Launch', st.launch, '°', 1, 'launch')}
        ${m('Backspin', st.backspin, 'rpm', 0, 'backspin')}
        ${m('Apex', st.apex, 'm', 1, 'apex')}
        ${st.toTarget.n ? kv('Distance from target', `${st.toTarget.avg.toFixed(1)} m <span class="muted" style="font-size:12px">(${st.toTarget.n} shots)</span>`) : ''}
        ${st.signed ? m('Sidespin', st.sidespin, 'rpm', 0, 'sidespin') : `<p class="muted" style="font-size:12px">Left/right direction isn't in this data (path, face and sidespin have no draw/fade or in/out sign), so miss patterns aren't shown.</p>`}
        ${prev && prev.n ? '<p class="muted" style="font-size:12px">With fewer than about 20 shots per period, differences of a few metres or mph are usually normal variation.</p>' : ''}`
      : `<p class="muted" style="font-size:14px">No ${esc(ui.lmClub)} shots in this period.</p>`}
      <h2 style="margin-top:8px">Sessions</h2>
      ${sessions.map((s) => { const n = store.data().launchShots.filter((x) => x.sessionId === s.id).length; return `
        <div class="kv"><span class="k">${fmtDate(s.date)} · ${esc(s.device || 'Launch monitor')}<br><span style="font-size:12px">${n} shots${s.fileName ? ' · ' + esc(s.fileName) : ''}</span></span>
        ${ui.confirm === 'dels:' + s.id ? `<span><button class="linkbtn" type="button" data-action="delsessyes" data-id="${s.id}" style="color:var(--bad)">Delete</button> <button class="linkbtn" type="button" data-action="cancel">Keep</button></span>`
          : `<button class="linkbtn" type="button" data-action="delsess" data-id="${s.id}">Remove</button>`}</div>`; }).join('')}
    </div>`;
}

// ----- Past score entry -----
function renderPastForm() {
  const f = ui.past;
  const courses = store.data().courses.map((c) => c.name);
  const holes = Array.from({ length: f.holeCount }, (_, i) => i + 1);
  $('#s-perf').innerHTML = `
    <button class="linkbtn" type="button" data-action="pastcancel">‹ My game</button>
    <h1>Add a past round</h1>
    <div class="card">
      <div class="field"><label class="label" for="pcourse">Course</label>
        <input class="input" id="pcourse" list="pcourselist" value="${esc(f.courseName)}" placeholder="Course name" autocomplete="off">
        <datalist id="pcourselist">${courses.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="grid2">
        <div class="field"><label class="label" for="pdate">Date</label><input class="input" id="pdate" type="date" value="${esc(f.date)}"></div>
        <div class="field"><span class="label">Holes</span><div class="chips">${[9, 18].map((n) => `<button type="button" class="chip" data-action="phc" data-v="${n}" aria-pressed="${f.holeCount === n}">${n}</button>`).join('')}</div></div>
      </div>
      <span class="label">What do you have?</span>
      <div class="chips">${[['total', 'Total score'], ['holes', 'Hole by hole']].map(([v, l]) => `<button type="button" class="chip" data-action="pdetail" data-v="${v}" aria-pressed="${f.detail === v}">${l}</button>`).join('')}</div>
      ${f.detail === 'total' ? `
        <div class="grid2">
          <div class="field"><label class="label" for="pscore">Score</label><input class="input" id="pscore" inputmode="numeric" value="${esc(f.totalScore ?? '')}" placeholder="${f.holeCount === 9 ? 'e.g. 44' : 'e.g. 88'}"></div>
          <div class="field"><label class="label" for="ppar">Course par</label><input class="input" id="ppar" inputmode="numeric" value="${esc(f.parTotal ?? '')}"></div>
        </div>
        <div class="field"><label class="label" for="pputts">Putts (optional)</label><input class="input" id="pputts" inputmode="numeric" value="${esc(f.totalPutts ?? '')}"></div>`
      : `<table class="sc entry"><tr><th>Hole</th><th>Par</th><th>Score</th><th>Putts</th></tr>
        ${holes.map((n) => { const h = f.holes[n - 1] || {}; return `<tr><td>${n}</td>
          <td><input class="cell" data-h="${n}" data-k="par" inputmode="numeric" value="${esc(h.par ?? '')}" aria-label="Hole ${n} par"></td>
          <td><input class="cell" data-h="${n}" data-k="score" inputmode="numeric" value="${esc(h.score ?? '')}" aria-label="Hole ${n} score"></td>
          <td><input class="cell" data-h="${n}" data-k="putts" inputmode="numeric" value="${esc(h.putts ?? '')}" aria-label="Hole ${n} putts"></td></tr>`; }).join('')}
        </table>`}
      <div class="chips"><button type="button" class="chip" data-action="pcomp" aria-pressed="${f.competition}">Competition round</button></div>
      <div class="btns"><button class="btn" type="button" data-action="pastsave">SAVE ROUND</button><button class="btn sec" type="button" data-action="pastsaveadd">SAVE + ADD ANOTHER</button></div>
      <p class="err" aria-live="polite">${esc(ui.msg)}</p>
    </div>
    <p class="muted" style="font-size:13px">Tip: copy scores from your Golfigo record or old scorecards. Pars are remembered per course.</p>`;
}

function newPast(prev) {
  const p = store.data().player;
  const courseName = prev ? prev.courseName : (p.homeCourse || '');
  const f = { courseName, date: prev ? prev.date : todayISO(), holeCount: prev ? prev.holeCount : 18, detail: prev ? prev.detail : 'total', totalScore: null, parTotal: null, totalPutts: null, holes: [], competition: false };
  fillPars(f);
  return f;
}

function fillPars(f) {
  const c = f.courseName && store.findCourse(f.courseName);
  f.holes = Array.from({ length: f.holeCount }, (_, i) => {
    const known = c && c.holes && c.holes.find((h) => h.n === i + 1);
    const cur = f.holes[i] || {};
    return { n: i + 1, par: cur.par ?? (known ? known.par : null), score: cur.score ?? null, putts: cur.putts ?? null };
  });
  if (f.parTotal == null) {
    const known = f.holes.every((h) => h.par);
    f.parTotal = known ? f.holes.reduce((a, h) => a + h.par, 0) : f.holeCount === 9 ? 36 : 72;
  }
}

function readPast() {
  const f = ui.past;
  const v = (id) => { const el = $('#' + id); return el ? el.value.trim() : null; };
  const n = (x) => (x === '' || x == null ? null : Number(x));
  if ($('#pcourse')) { const nc = v('pcourse'); if (nc !== f.courseName) { f.courseName = nc; f.parTotal = null; fillPars(f); } }
  if ($('#pdate')) f.date = v('pdate');
  if ($('#pscore')) { f.totalScore = n(v('pscore')); f.parTotal = n(v('ppar')); f.totalPutts = n(v('pputts')); }
  $$('.cell[data-h]').forEach((el) => { const h = f.holes[Number(el.dataset.h) - 1]; h[el.dataset.k] = n(el.value.trim()); });
}

function savePast(again) {
  readPast();
  const f = ui.past;
  const fail = (m) => { ui.msg = m; render(); };
  if (!f.courseName) return fail('Add the course name.');
  if (!f.date) return fail('Add the date.');
  const bad = (x, lo, hi) => x == null || isNaN(x) || x < lo || x > hi;
  const fields = { courseName: f.courseName, date: f.date, holeCount: f.holeCount, detail: f.detail, competition: f.competition, source: 'manual' };
  if (f.detail === 'total') {
    const lo = f.holeCount === 9 ? 25 : 50, hi = f.holeCount === 9 ? 90 : 180;
    if (bad(f.totalScore, lo, hi)) return fail(`Enter a score between ${lo} and ${hi}.`);
    if (bad(f.parTotal, f.holeCount * 3, f.holeCount * 5)) return fail('Enter the course par.');
    if (f.totalPutts != null && bad(f.totalPutts, 0, f.holeCount * 6)) return fail('Putts look wrong.');
    Object.assign(fields, { totalScore: f.totalScore, parTotal: f.parTotal, totalPutts: f.totalPutts });
  } else {
    for (const h of f.holes) {
      if (bad(h.score, 1, 15)) return fail(`Enter a score for hole ${h.n}.`);
      if (h.par != null && bad(h.par, 3, 6)) return fail(`Par on hole ${h.n} should be 3, 4 or 5.`);
      if (h.putts != null && bad(h.putts, 0, h.score)) return fail(`Putts on hole ${h.n} look wrong.`);
    }
    fields.holes = f.holes.map((h) => ({ n: h.n, par: h.par || 4, score: h.score, putts: h.putts }));
  }
  if (store.isDuplicateRound(fields)) return fail('You already have this round (same course, date and score).');
  store.addPastRound(fields);
  store.requestPersistence();
  if (again) { ui.past = newPast(f); ui.msg = `Saved ${f.courseName}, ${fmtDate(f.date)}. Add the next one.`; render(); $('#screens').scrollTop = 0; }
  else { ui.perfView = null; ui.past = null; ui.msg = 'Round saved.'; render(); }
}

// ----- File import review -----
async function handleDataFile(file) {
  ui.importErr = '';
  try {
    const sheets = await readTable(file);
    const lm = parseLaunch(sheets);
    if (lm) {
      const groups = groupLaunch(lm.shots);
      const dupes = lm.shots.filter((s) => store.launchShotExists(s)).length;
      const fileDate = lm.shots.map((s) => s.date).find(Boolean);
      ui.imp = { kind: 'launch', fileName: file.name, groups, dupes, total: lm.shots.length, date: (typeof fileDate === 'string' && /^\d{4}-\d\d-\d\d/.test(fileDate)) ? fileDate.slice(0, 10) : todayISO(), device: 'Simulator', signed: lm.shots.some((s) => s.signed) };
    } else {
      const rd = parseRounds(sheets);
      if (!rd) throw new Error('I couldn\'t find launch monitor columns (Carry, Ball speed…) or round columns (Date, Course, Score) in this file.');
      ui.imp = { kind: 'rounds', fileName: file.name, rounds: rd.rounds.map((r) => ({ ...r, dup: store.isDuplicateRound(r) })), problems: rd.problems };
    }
    ui.perfView = 'import';
  } catch (e) {
    console.error(e);
    ui.importErr = e.message || 'Could not read that file.';
  }
  render();
  $('#screens').scrollTop = 0;
}

function renderImportReview() {
  const im = ui.imp;
  if (im.kind === 'launch') {
    const newCount = im.groups.reduce((a, g) => a + (g.skip ? 0 : g.shots.length), 0);
    $('#s-perf').innerHTML = `
      <button class="linkbtn" type="button" data-action="impcancel">‹ Cancel import</button>
      <h1>Import launch monitor shots</h1>
      <p class="muted">${esc(im.fileName)}: ${im.total} shots in ${im.groups.length} group${im.groups.length > 1 ? 's' : ''}.${im.dupes ? ` ${im.dupes} are already saved and will be skipped.` : ''}</p>
      <div class="card">
        <div class="grid2">
          <div class="field"><label class="label" for="lmdate">Session date</label><input class="input" id="lmdate" type="date" value="${esc(im.date)}"></div>
          <div class="field"><label class="label" for="lmdevice">Device</label><input class="input" id="lmdevice" value="${esc(im.device)}"></div>
        </div>
        ${im.signed ? '' : '<p class="muted" style="font-size:13px">This file has no left/right direction for path, face or sidespin, so those are saved as sizes only.</p>'}
      </div>
      ${im.groups.map((g, gi) => `
        <div class="card">
          <div class="row between"><h2>${esc(g.name)}</h2><span class="muted" style="font-size:14px">${g.shots.length} shots</span></div>
          <p class="muted" style="font-size:13px">Avg carry ${g.avgCarry != null ? g.avgCarry.toFixed(0) + ' m' : '–'} · club speed ${g.avgClubSpeed != null ? g.avgClubSpeed.toFixed(0) + ' mph' : '–'}</p>
          <span class="label">Which club?</span>
          <div class="chips">${CLUBS.filter((c) => c !== 'Putter').map((c) => `<button type="button" class="chip" data-action="gclub" data-g="${gi}" data-v="${c}" aria-pressed="${g.club === c && !g.skip}">${c}</button>`).join('')}
            <button type="button" class="chip" data-action="gskip" data-g="${gi}" aria-pressed="${!!g.skip}">Skip group</button></div>
          <details><summary class="label">Show shots</summary>
            <div style="overflow-x:auto"><table class="sc"><tr><th>#</th><th>Carry</th><th>Total</th><th>Club</th><th>Ball</th><th>Smash</th><th>Launch</th><th>Spin</th></tr>
            ${g.shots.map((s, i) => `<tr class="${store.launchShotExists(s) ? 'dupe' : ''}"><td>${i + 1}</td><td>${s.carry ?? '–'}</td><td>${s.total ?? '–'}</td><td>${s.clubSpeed ?? '–'}</td><td>${s.ballSpeed ?? '–'}</td><td>${s.smash ?? '–'}</td><td>${s.launch ?? '–'}</td><td>${s.backspin ?? '–'}</td></tr>`).join('')}
            </table></div></details>
        </div>`).join('')}
      <div class="btns"><button class="btn" type="button" data-action="impsave">SAVE ${newCount} SHOTS</button></div>
      <p class="err" aria-live="polite">${esc(ui.msg)}</p>`;
    return;
  }
  const fresh = im.rounds.filter((r) => !r.dup);
  $('#s-perf').innerHTML = `
    <button class="linkbtn" type="button" data-action="impcancel">‹ Cancel import</button>
    <h1>Import rounds</h1>
    <p class="muted">${esc(im.fileName)}: ${im.rounds.length} rounds found${im.rounds.length - fresh.length ? `, ${im.rounds.length - fresh.length} already saved` : ''}.</p>
    ${im.problems.length ? `<div class="card"><h2>Rows skipped</h2>${im.problems.slice(0, 8).map((p) => `<p class="err">${esc(p)}</p>`).join('')}${im.problems.length > 8 ? `<p class="muted">…and ${im.problems.length - 8} more</p>` : ''}</div>` : ''}
    <div class="card">
      ${im.rounds.map((r) => `<div class="kv"><span class="k">${esc(r.courseName)}${r.competition ? ' <span class="tag">COMP</span>' : ''}<br><span style="font-size:12px">${fmtDate(r.date)} · ${r.holeCount} holes${r.detail === 'holes' ? ' · hole by hole' : ''}${r.parGuessed ? ' · par assumed ' + r.parTotal : ''}${r.dup ? ' · already saved' : ''}</span></span>
        <span class="v2">${r.detail === 'total' ? r.totalScore : r.holes.reduce((a, h) => a + h.score, 0)}</span></div>`).join('')}
    </div>
    <div class="btns"><button class="btn" type="button" data-action="impsave" ${fresh.length ? '' : 'disabled'}>SAVE ${fresh.length} ROUNDS</button></div>
    <p class="err" aria-live="polite">${esc(ui.msg)}</p>`;
}

function saveImport() {
  const im = ui.imp;
  if (im.kind === 'launch') {
    const date = $('#lmdate').value || todayISO();
    const device = $('#lmdevice').value.trim() || 'Launch monitor';
    const missing = im.groups.find((g) => !g.skip && !g.club);
    if (missing) { ui.msg = `Pick a club for "${missing.name}" or skip it.`; return render(); }
    const shots = [];
    for (const g of im.groups) if (!g.skip) for (const s of g.shots) {
      if (store.launchShotExists(s)) continue;
      const { date: _d, ...rest } = s;
      shots.push({ ...rest, club: g.club });
    }
    if (!shots.length) { ui.msg = 'Nothing new to save.'; return render(); }
    store.addLaunchSession({ date, device, source: 'file', fileName: im.fileName }, shots);
    ui.lmClub = shots[0].club; ui.lmPeriod = null;
    ui.msg = `Saved ${shots.length} launch monitor shots.`;
  } else {
    let n = 0;
    for (const r of im.rounds) if (!r.dup && !store.isDuplicateRound(r)) { store.addPastRound(r); n++; }
    ui.msg = `Imported ${n} rounds.`;
  }
  store.requestPersistence();
  ui.imp = null; ui.perfView = null;
  render(); $('#screens').scrollTop = 0;
}

function renderRoundDetail(id) {
  const r = store.data().rounds.find((x) => x.id === id);
  if (!r) { ui.viewRound = null; return renderPerf(); }
  const s = roundStats(r);
  const half = (from, to) => {
    const hs = s.holes.filter((h) => h.hole.n >= from && h.hole.n <= to);
    if (!hs.length) return '';
    const cls = (h) => (!h.holed ? '' : h.toPar < 0 ? 'under' : h.toPar > 0 ? 'over' : '');
    return `<table class="sc"><tr><th>Hole</th>${hs.map((h) => `<th>${h.hole.n}</th>`).join('')}</tr>
      <tr><th>Par</th>${hs.map((h) => `<td>${h.hole.par}</td>`).join('')}</tr>
      <tr><th>Score</th>${hs.map((h) => `<td class="${cls(h)}">${h.holed ? h.strokes : '–'}</td>`).join('')}</tr>
      <tr><th>Putts</th>${hs.map((h) => `<td>${h.holed && h.puttsKnown ? h.putts : '–'}</td>`).join('')}</tr></table>`;
  };
  const isShots = r.detail === 'shots';
  $('#s-perf').innerHTML = `
    <button class="linkbtn" type="button" data-action="back">‹ All rounds</button>
    <h1>${esc(r.courseName)}</h1>
    <p class="muted">${fmtDate(r.date)}${r.status === 'in_progress' ? ' · in progress' : ''}${r.competition ? ' · competition' : ''} · ${SOURCE[r.source] || 'Imported'}</p>
    <div class="stats">
      <div class="card stat"><span class="eyebrow">Score</span><span class="v">${s.holesPlayed ? s.strokes : '–'}</span><span class="n">${s.holesPlayed ? (s.toPar != null ? fmtToPar(s.toPar) : '') + (r.detail === 'total' ? ` · ${r.holes.length} holes` : ' thru ' + s.holesPlayed) : 'No holes finished'}</span></div>
      <div class="card stat"><span class="eyebrow">Putts</span><span class="v">${s.puttsHoles ? s.putts : '–'}</span><span class="n">${isShots ? s.shotsLogged + ' shots logged' : s.puttsHoles ? '' : 'Not recorded'}</span></div>
    </div>
    ${r.detail !== 'total' ? `<div class="card" style="overflow-x:auto">${half(1, 9)}${half(10, 18)}</div>` : ''}
    ${isShots ? `<div class="card">
      ${kv('Fairways', s.fairwayChances ? `${s.fairways}/${s.fairwayChances}` : '–')}
      ${kv('Greens in regulation', `${s.gir}/${s.holesPlayed}`)}
      ${kv('Penalty strokes', s.penalties)}
    </div>` : ''}
    ${s.holes.filter((h) => h.shots.length).map((h) => `
      <div class="card"><div class="row between"><h2>Hole ${h.hole.n} · par ${h.hole.par}${h.hole.yards ? ' · ' + h.hole.yards + ' yd' : ''}</h2><b>${h.holed ? h.strokes : '…'}</b></div>
      <ol class="shotlist">${h.shots.map((x) => `<li><span class="n">${x.seq}</span><span class="t">${esc(x.club)} · ${esc(x.startLie)} ${distLabel(x.startLie, x.startDist)} → ${esc(x.endLie)} ${x.endLie === 'holed' ? '' : distLabel(x.endLie, x.endDist)}${x.penalty ? ` <span class="neg">+${x.penalty} pen</span>` : ''}</span></li>`).join('')}</ol></div>`).join('')}
    <div class="btns">
      ${!isShots ? '' : r.status === 'complete' ? `<button class="btn sec" type="button" data-action="reopen" data-id="${r.id}">EDIT ROUND</button>` : `<button class="btn sec" type="button" data-go="play">CONTINUE</button>`}
      <button class="btn danger" type="button" data-action="delround" data-id="${r.id}">DELETE</button>
    </div>
    ${ui.confirm === 'del' ? `<div class="card" style="border-color:var(--bad)"><p>Delete this round${isShots ? ` and all ${s.shotsLogged} shots` : ''}? This cannot be undone.</p>
      <div class="btns"><button class="btn danger" type="button" data-action="delyes" data-id="${r.id}">DELETE ROUND</button><button class="btn sec" type="button" data-action="cancel">KEEP IT</button></div></div>` : ''}
    <p class="err" aria-live="polite">${esc(ui.msg)}</p>`;
}

// ----- Profile -----
function renderProfile() {
  const p = store.data().player || {};
  const onboarding = !store.data().player;
  const num = (v) => (v == null ? '' : v);
  $('#s-profile').innerHTML = `
    ${onboarding ? '<span class="eyebrow accent">Welcome</span><h1>Your golfer profile</h1><p class="muted">Two minutes now lets every stat and plan be about you. Everything stays on this device.</p>'
      : '<button class="linkbtn" type="button" data-go="home">‹ Home</button><h1>Profile</h1>'}
    <div class="card">
      <div class="field"><label class="label" for="pname">Name</label><input class="input" id="pname" value="${esc(p.name || '')}" autocomplete="given-name"></div>
      <div class="grid2">
        <div class="field"><label class="label" for="phcp">Handicap index</label><input class="input" id="phcp" inputmode="decimal" value="${num(p.handicap)}" placeholder="e.g. 11.8"></div>
        <div class="field"><label class="label" for="ptarget">Target handicap</label><input class="input" id="ptarget" inputmode="decimal" value="${num(p.targetHandicap)}" placeholder="e.g. 8.0"></div>
      </div>
      <div class="field"><label class="label" for="phome">Home course</label><input class="input" id="phome" value="${esc(p.homeCourse || '')}"></div>
      <div class="field"><label class="label" for="pmins">Practice time per week (minutes)</label><input class="input" id="pmins" inputmode="numeric" value="${num(p.practiceMinutesPerWeek)}" placeholder="e.g. 240"></div>
      <span class="label">Usual play day</span>
      <div class="chips" id="pday">${DAYNAMES.map((n, i) => `<button type="button" class="chip" data-day="${i}" aria-pressed="${p.preferredPlayDay === i}">${n}</button>`).join('')}</div>
      <button class="btn" type="button" data-action="saveprofile">${onboarding ? 'CREATE PROFILE' : 'SAVE PROFILE'}</button>
      <p class="err" aria-live="polite">${esc(ui.profileErr)}</p>
    </div>
    ${onboarding ? '' : `<div class="card"><span class="label">Appearance</span><div class="btns"><button class="btn sec small" type="button" data-action="theme">${document.documentElement.classList.contains('light') ? 'DARK MODE' : 'LIGHT MODE'}</button></div></div>`}`;
}

// ---------- Actions ----------
function readDraftInputs() {
  if (!ui.draft) return;
  const dist = $('#dist'); if (dist) ui.draft.endDist = dist.value.trim();
  const y = $('#yards'); if (y) ui.draft.yards = y.value.trim();
}

function saveShot() {
  readDraftInputs();
  const r = store.activeRound();
  const hole = r.holes.find((h) => h.n === ui.hole);
  const dr = ui.draft;
  let st = startOf(r, hole);
  if (st.seq === 1 && !hole.yards) {
    const y = parseInt(dr.yards, 10);
    if (!(y > 0 && y < 800)) { ui.msg = 'Enter the hole length in yards.'; return render(); }
    store.updateHole(r.id, hole.n, { yards: y });
    st = startOf(r, hole);
  }
  if (!dr.club) { ui.msg = 'Pick a club.'; return render(); }
  if (!dr.endLie) { ui.msg = 'Pick where the ball finished.'; return render(); }
  let endDist = 0;
  if (dr.endLie !== 'holed') {
    endDist = parseInt(dr.endDist, 10);
    const max = dr.endLie === 'green' ? 200 : 700;
    if (!(endDist >= 0 && endDist <= max)) { ui.msg = `Enter the distance left in ${dr.endLie === 'green' ? 'feet' : 'yards'}.`; return render(); }
  }
  store.addShot({ roundId: r.id, hole: hole.n, club: dr.club, startLie: st.lie, startDist: st.dist, endLie: dr.endLie, endDist, penalty: dr.penalty });
  ui.msg = ''; ui.draft = null;
  render();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-action]');
  if (!t) return;
  if (t.dataset.tab) return go(t.dataset.tab);
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.hc) { $$('#holecount .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === t))); return; }
  if (t.dataset.day != null) { const on = t.getAttribute('aria-pressed') !== 'true'; $$('#pday .chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); t.setAttribute('aria-pressed', String(on)); return; }
  const a = t.dataset.action;
  if (!a) return;
  const r = store.activeRound();
  switch (a) {
    case 'profile': ui.tab = 'profile'; ui.profileErr = ''; render(); break;
    case 'theme': {
      const light = document.documentElement.classList.toggle('light');
      localStorage.setItem('golfcoach.theme', light ? 'light' : 'dark');
      render(); break;
    }
    case 'saveprofile': {
      const name = $('#pname').value.trim();
      const parse = (id) => { const v = $('#' + id).value.trim().replace(',', '.'); return v === '' ? null : Number(v); };
      const handicap = parse('phcp'), targetHandicap = parse('ptarget'), mins = parse('pmins');
      if (!name) { ui.profileErr = 'Add your name.'; return render(); }
      if ([handicap, targetHandicap].some((v) => v != null && (isNaN(v) || v < -10 || v > 54))) { ui.profileErr = 'Handicaps should be between -10 and 54.'; return render(); }
      const dayBtn = $('#pday .chip[aria-pressed="true"]');
      store.savePlayer({ name, handicap, targetHandicap, homeCourse: $('#phome').value.trim(), practiceMinutesPerWeek: mins != null && !isNaN(mins) ? mins : null, preferredPlayDay: dayBtn ? Number(dayBtn.dataset.day) : null });
      store.requestPersistence();
      ui.profileErr = ''; go('home'); break;
    }
    case 'start': {
      const courseName = $('#course').value.trim();
      if (!courseName) { ui.msg = 'Add the course name.'; return render(); }
      const hc = Number($('#holecount .chip[aria-pressed="true"]').dataset.hc);
      store.startRound({ courseName, date: $('#rdate').value || todayISO(), holeCount: hc });
      store.requestPersistence();
      ui.hole = null; ui.draft = null; ui.msg = ''; render(); break;
    }
    case 'hole': readDraftInputs(); ui.hole = Number(t.dataset.n); ui.draft = null; ui.msg = ''; render(); $('#screens').scrollTop = 0; break;
    case 'par': store.updateHole(r.id, ui.hole, { par: Number(t.dataset.v) }); readDraftInputs(); render(); break;
    case 'edityards': readDraftInputs(); ui.editYards = true; render(); $('#edityards').focus(); break;
    case 'saveyards': {
      const y = parseInt($('#edityards').value, 10);
      if (y > 0 && y < 800) store.updateHole(r.id, ui.hole, { yards: y });
      ui.editYards = false; render(); break;
    }
    case 'cancel': ui.confirm = null; render(); break;
    case 'club': readDraftInputs(); ui.draft.club = t.dataset.v; render(); break;
    case 'finishlie': {
      readDraftInputs();
      const prevUnit = unitFor(ui.draft.endLie);
      ui.draft.endLie = t.dataset.v;
      if (unitFor(ui.draft.endLie) !== prevUnit) ui.draft.endDist = '';
      ui.msg = ''; render();
      const d = $('#dist'); if (d && !d.value) d.focus();
      break;
    }
    case 'pen': readDraftInputs(); ui.draft.penalty = Number(t.dataset.v); render(); break;
    case 'save': saveShot(); break;
    case 'undo': store.removeLastShot(r.id, ui.hole); ui.draft = null; ui.msg = ''; render(); break;
    case 'finish':
      readDraftInputs();
      if (!roundStats(r).complete) { ui.confirm = 'finish'; render(); break; }
      // falls through
    case 'finishyes': {
      ui.confirm = null; ui.hole = null; ui.draft = null;
      if (roundStats(r).shotsLogged === 0) { store.deleteRound(r.id); go('play'); break; }
      store.completeRound(r.id);
      ui.viewRound = r.id; go('perf'); break;
    }
    case 'viewround': ui.viewRound = t.dataset.id; ui.msg = ''; render(); $('#screens').scrollTop = 0; break;
    case 'back': ui.viewRound = null; ui.msg = ''; ui.confirm = null; render(); break;
    case 'reopen': {
      const cur = store.activeRound();
      if (cur && cur.id !== t.dataset.id) { ui.msg = 'Finish your round in progress first.'; return render(); }
      store.reopenRound(t.dataset.id); ui.hole = null; ui.draft = null; go('play'); break;
    }
    case 'delround': ui.confirm = 'del'; render(); break;
    case 'delyes': store.deleteRound(t.dataset.id); ui.confirm = null; ui.viewRound = null; render(); break;
    case 'importyes':
      try { store.importJSON(ui.pendingImport.text); ui.msg = 'Backup restored.'; } catch (err) { ui.msg = err.message; }
      ui.pendingImport = null; render(); break;
    case 'importno': ui.pendingImport = null; ui.msg = ''; render(); break;
    case 'pastnew': ui.past = newPast(); ui.perfView = 'past'; ui.msg = ''; render(); $('#screens').scrollTop = 0; break;
    case 'pastcancel': ui.past = null; ui.perfView = null; ui.msg = ''; render(); break;
    case 'phc': readPast(); ui.past.holeCount = Number(t.dataset.v); ui.past.parTotal = null; fillPars(ui.past); render(); break;
    case 'pdetail': readPast(); ui.past.detail = t.dataset.v; render(); break;
    case 'pcomp': readPast(); ui.past.competition = !ui.past.competition; render(); break;
    case 'pastsave': savePast(false); break;
    case 'pastsaveadd': savePast(true); break;
    case 'impcancel': ui.imp = null; ui.perfView = null; ui.msg = ''; render(); break;
    case 'gclub': { const g = ui.imp.groups[Number(t.dataset.g)]; g.club = t.dataset.v; g.skip = false; ui.msg = ''; keepScroll(render); break; }
    case 'gskip': { const g = ui.imp.groups[Number(t.dataset.g)]; g.skip = !g.skip; keepScroll(render); break; }
    case 'impsave': ui.imp.date = $('#lmdate')?.value || ui.imp.date; saveImport(); break;
    case 'lmclub': ui.lmClub = t.dataset.v; keepScroll(render); break;
    case 'lmperiod': ui.lmPeriod = t.dataset.v ? Number(t.dataset.v) : null; keepScroll(render); break;
    case 'delsess': ui.confirm = 'dels:' + t.dataset.id; keepScroll(render); break;
    case 'delsessyes': store.deleteLaunchSession(t.dataset.id); ui.confirm = null; keepScroll(render); break;
    case 'template': download('golf-rounds-template.csv', ROUNDS_TEMPLATE, 'text/csv'); break;
    case 'export': {
      download(`golf-coach-backup-${todayISO()}.json`, store.exportJSON(), 'application/json');
      ui.msg = 'Backup downloaded.'; render(); break;
    }
  }
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function keepScroll(fn) {
  const el = $('#screens'); const top = el.scrollTop; fn(); el.scrollTop = top;
}

document.addEventListener('change', async (e) => {
  if (e.target.id === 'datafile' && e.target.files[0]) return handleDataFile(e.target.files[0]);
  if (e.target.id !== 'importfile' || !e.target.files[0]) return;
  try {
    const text = await e.target.files[0].text();
    const doc = JSON.parse(text);
    if (!doc || !Array.isArray(doc.rounds) || !Array.isArray(doc.shots)) throw new Error('This file is not a Golf Coach backup.');
    ui.pendingImport = { text, rounds: doc.rounds.length, shots: doc.shots.length };
    ui.msg = '';
  } catch (err) {
    ui.msg = err.message || 'Could not read that file.';
  }
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.target.id === 'dist' || e.target.id === 'yards')) { e.preventDefault(); saveShot(); }
});

// ---------- Boot ----------
if (localStorage.getItem('golfcoach.theme') === 'light') document.documentElement.classList.add('light');
render();
