import * as store from './store.js';
import { CLUBS } from './store.js';
import { holeStats, roundStats, careerStats, nextStep } from './stats.js';

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
  editYards: false
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
  if (tab !== 'perf') ui.viewRound = null;
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
function renderPerf() {
  if (ui.viewRound) return renderRoundDetail(ui.viewRound);
  const d = store.data();
  const c = careerStats();
  const rounds = d.rounds.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
  const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v2">${v}</span></div>`;

  const statsCard = c.recent ? `
    <div class="card">
      <div class="row between"><h2>Last ${c.recent} round${c.recent > 1 ? 's' : ''}</h2>${LIVE}</div>
      <p class="muted" style="font-size:12px">${c.holes} holes, normalised to 18.</p>
      ${kv('Score per 18', fmt1(c.scorePer18) + ` (${c.toParPer18 >= 0 ? '+' : ''}${c.toParPer18.toFixed(1)})`)}
      ${kv('Putts per 18', fmt1(c.puttsPer18))}
      ${kv('Fairways hit', c.fairwayPct != null ? c.fairwayPct.toFixed(0) + '%' : '–')}
      ${kv('Greens in regulation', c.girPct != null ? c.girPct.toFixed(0) + '%' : '–')}
      ${kv('Penalty strokes per 18', fmt1(c.penaltiesPer18))}
    </div>
    <div class="card">
      <h2>Scoring by par</h2>
      ${[3, 4, 5].filter((p) => c.byPar[p]).map((p) => kv(`Par ${p} <span class="muted" style="font-size:12px">(${c.byPar[p].n} holes)</span>`, (c.byPar[p].toPar / c.byPar[p].n >= 0 ? '+' : '') + (c.byPar[p].toPar / c.byPar[p].n).toFixed(2))).join('')}
    </div>
    <div class="card">
      <h2>Putts by first-putt distance</h2>
      ${c.putting.filter((b) => b.n).map((b) => kv(`${b.label} <span class="muted" style="font-size:12px">(${b.n})</span>`, (b.putts / b.n).toFixed(2))).join('') || '<p class="muted" style="font-size:14px">No putts recorded yet.</p>'}
    </div>` : `
    <div class="card"><h2>No completed rounds yet</h2><p class="muted">Finish a round on the Play tab and your statistics appear here.</p>
      <div class="btns"><button class="btn" type="button" data-go="play">START A ROUND</button></div></div>`;

  $('#s-perf').innerHTML = `
    <h1>My game</h1>
    ${statsCard}
    <div class="card">
      <h2>Rounds</h2>
      ${rounds.length ? rounds.map((r) => { const s = roundStats(r); return `
        <button class="roundrow" type="button" data-action="viewround" data-id="${r.id}">
          <span><b>${esc(r.courseName)}</b><br><span class="muted" style="font-size:13px">${fmtDate(r.date)} · ${s.holesPlayed}/${r.holes.length} holes${r.status === 'in_progress' ? ' · in progress' : ''}</span></span>
          <span class="s">${s.holesPlayed ? s.strokes : '–'}<span class="muted" style="font-size:13px;font-weight:600"> ${s.holesPlayed ? fmtToPar(s.toPar) : ''}</span></span>
        </button>`; }).join('') : '<p class="muted" style="font-size:14px">Nothing recorded yet.</p>'}
    </div>
    <div class="card dim">
      <div class="row between"><h2>Strokes gained</h2>${DEMO}</div>
      <p class="muted" style="font-size:14px">Milestone 2 turns your saved shots into strokes gained for off the tee, approach, around the green and putting. The shot data you record now is already in the right shape for it.</p>
    </div>
    <div class="card">
      <h2>Your data</h2>
      <p class="muted" style="font-size:14px">${d.rounds.length} rounds and ${d.shots.length} shots are stored on this device. Download a backup now and then, especially before clearing browser data.</p>
      <div class="btns">
        <button class="btn sec small" type="button" data-action="export">DOWNLOAD BACKUP</button>
        <label class="btn sec small" style="display:flex;align-items:center;justify-content:center">RESTORE<input type="file" accept="application/json,.json" id="importfile" hidden></label>
      </div>
      ${ui.pendingImport ? `<p>This backup has ${ui.pendingImport.rounds} rounds and ${ui.pendingImport.shots} shots. Restoring replaces everything on this device.</p>
        <div class="btns"><button class="btn" type="button" data-action="importyes">REPLACE MY DATA</button><button class="btn sec" type="button" data-action="importno">CANCEL</button></div>` : ''}
      <p class="toast" aria-live="polite">${esc(ui.msg)}</p>
    </div>`;
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
      <tr><th>Putts</th>${hs.map((h) => `<td>${h.holed ? h.putts : '–'}</td>`).join('')}</tr></table>`;
  };
  const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v2">${v}</span></div>`;
  $('#s-perf').innerHTML = `
    <button class="linkbtn" type="button" data-action="back">‹ All rounds</button>
    <h1>${esc(r.courseName)}</h1>
    <p class="muted">${fmtDate(r.date)}${r.status === 'in_progress' ? ' · in progress' : ''}</p>
    <div class="stats">
      <div class="card stat"><span class="eyebrow">Score</span><span class="v">${s.holesPlayed ? s.strokes : '–'}</span><span class="n">${s.holesPlayed ? fmtToPar(s.toPar) + ' thru ' + s.holesPlayed : 'No holes finished'}</span></div>
      <div class="card stat"><span class="eyebrow">Putts</span><span class="v">${s.putts}</span><span class="n">${s.shotsLogged} shots logged</span></div>
    </div>
    <div class="card" style="overflow-x:auto">${half(1, 9)}${half(10, 18)}</div>
    <div class="card">
      ${kv('Fairways', s.fairwayChances ? `${s.fairways}/${s.fairwayChances}` : '–')}
      ${kv('Greens in regulation', `${s.gir}/${s.holesPlayed}`)}
      ${kv('Penalty strokes', s.penalties)}
    </div>
    ${s.holes.filter((h) => h.shots.length).map((h) => `
      <div class="card"><div class="row between"><h2>Hole ${h.hole.n} · par ${h.hole.par}${h.hole.yards ? ' · ' + h.hole.yards + ' yd' : ''}</h2><b>${h.holed ? h.strokes : '…'}</b></div>
      <ol class="shotlist">${h.shots.map((x) => `<li><span class="n">${x.seq}</span><span class="t">${esc(x.club)} · ${esc(x.startLie)} ${distLabel(x.startLie, x.startDist)} → ${esc(x.endLie)} ${x.endLie === 'holed' ? '' : distLabel(x.endLie, x.endDist)}${x.penalty ? ` <span class="neg">+${x.penalty} pen</span>` : ''}</span></li>`).join('')}</ol></div>`).join('')}
    <div class="btns">
      ${r.status === 'complete' ? `<button class="btn sec" type="button" data-action="reopen" data-id="${r.id}">EDIT ROUND</button>` : `<button class="btn sec" type="button" data-go="play">CONTINUE</button>`}
      <button class="btn danger" type="button" data-action="delround" data-id="${r.id}">DELETE</button>
    </div>
    ${ui.confirm === 'del' ? `<div class="card" style="border-color:var(--bad)"><p>Delete this round and all ${s.shotsLogged} shots? This cannot be undone.</p>
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
    case 'export': {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `golf-coach-backup-${todayISO()}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      ui.msg = 'Backup downloaded.'; render(); break;
    }
  }
});

document.addEventListener('change', async (e) => {
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
