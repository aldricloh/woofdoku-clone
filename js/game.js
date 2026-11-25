/* Woofdoku game: UI, input, sound, saves */
{
const $ = id => document.getElementById(id);
const LEVELS = 40;
const sizeFor = l => l <= 4 ? 5 : l <= 12 ? 6 : l <= 22 ? 7 : l <= 32 ? 8 : 9;
const DIFFS = [['Easy', 6], ['Medium', 7], ['Hard', 8], ['Expert', 9]];
const cache = {};
function puzzleFor(seed, n) {
  const k = n + ':' + seed;
  if (!cache[k]) { let s = seed, p = null; while (!(p = WD.make(n, s))) s++; cache[k] = p; }
  return cache[k];
}

let S = { mode: 'levels', level: 1, diff: 0, done: [], endSeed: 0, endWins: [0, 0, 0, 0], sound: true, vib: true, seen: false, marks: {} };
let P = null, marks = [], key = '', won = false, prevBad = new Set();

function load(d) {
  let saved = d && d.save;
  if (!saved) { try { saved = JSON.parse(localStorage.getItem('woofdoku') || 'null'); } catch (e) {} }
  if (saved) S = Object.assign(S, saved);
}
function save() { try { localStorage.setItem('woofdoku', JSON.stringify(S)); } catch (e) {} }

/* ---------- sound + haptics ---------- */
let ac = null;
function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
function tone(type, f1, f2, dur, vol, delay = 0, filt) {
  const a = ctx(); if (!a || !S.sound) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filt) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; f.Q.value = 6; o.connect(f); node = f; }
  node.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const woof = (d = 0) => { const p = 1 + (Math.random() - .5) * .15; tone('sawtooth', 520 * p, 190 * p, .14, .14, d, 1100); tone('square', 260 * p, 120 * p, .1, .05, d + .015, 700); };
const sfx = {
  x: () => tone('sine', 880, 660, .05, .07),
  dog: () => woof(),
  clear: () => tone('sine', 420, 260, .07, .06),
  bad: () => { tone('square', 150, 120, .18, .05); tone('square', 156, 118, .18, .04, .02); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.01, .22, .1, i * .1)); woof(.48); woof(.66); }
};
const buzz = p => { if (S.vib && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

/* ---------- board ---------- */
function lines(n, reg) {
  let thin = '', thick = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    if (x < n - 1) (reg[i] !== reg[i + 1] ? (s => thick += s) : (s => thin += s))(`M${x + 1} ${y}V${y + 1}`);
    if (y < n - 1) (reg[i] !== reg[i + n] ? (s => thick += s) : (s => thin += s))(`M${x} ${y + 1}H${x + 1}`);
  }
  return `<svg class="lines" viewBox="0 0 ${n} ${n}" preserveAspectRatio="none" aria-hidden="true"><path d="${thin}" stroke="var(--ink)" stroke-opacity=".15" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/><path d="${thick}" stroke="var(--edge)" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round" fill="none"/></svg>`;
}
const DOG = '<svg><use href="#dog"/></svg>', XM = '<svg class="x"><use href="#xm"/></svg>';
function cellsHTML(n, reg, m) {
  return reg.map((g, i) => `<div class="cell" role="gridcell" data-i="${i}" style="background-color:var(--r${g})">${m[i] === 2 ? DOG : m[i] === 1 ? XM : ''}</div>`).join('') + lines(n, reg);
}
const board = $('board');
function build() {
  const n = P.n;
  board.style.setProperty('--n', n);
  board.innerHTML = cellsHTML(n, P.reg, marks);
  board.querySelectorAll('.cell').forEach((c, i) => { c.tabIndex = i === 0 ? 0 : -1; c.setAttribute('aria-label', label(i)); });
  prevBad = new Set(); refresh(false);
}
const label = i => `Row ${Math.floor(i / P.n) + 1}, column ${i % P.n + 1}, ${['empty', 'marked X', 'dog'][marks[i]]}`;
function conflicts() {
  const n = P.n, dogs = [], bad = new Set();
  marks.forEach((v, i) => v === 2 && dogs.push(i));
  for (let a = 0; a < dogs.length; a++) for (let b = a + 1; b < dogs.length; b++) {
    const i = dogs[a], j = dogs[b], yi = Math.floor(i / n), xi = i % n, yj = Math.floor(j / n), xj = j % n;
    if (yi === yj || xi === xj || P.reg[i] === P.reg[j] || (Math.abs(yi - yj) < 2 && Math.abs(xi - xj) < 2)) { bad.add(i); bad.add(j); }
  }
  return { dogs, bad };
}
function refresh(fx = true) {
  const { dogs, bad } = conflicts(), cells = board.children;
  let fresh = false;
  for (let i = 0; i < marks.length; i++) {
    cells[i].classList.toggle('bad', bad.has(i));
    if (bad.has(i) && !prevBad.has(i)) { fresh = true; if (fx) { cells[i].classList.remove('shake'); void cells[i].offsetWidth; cells[i].classList.add('shake'); } }
  }
  prevBad = bad;
  const c = $('count');
  c.className = 'count' + (bad.size ? ' bad' : '');
  c.innerHTML = `<span>${bad.size ? 'Too close!' : 'Dogs'} ${dogs.length}/${P.n}</span><span class="dots">${Array.from({ length: P.n }, (_, i) => `<i class="${i < dogs.length ? 'on' : ''}"></i>`).join('')}</span>`;
  if (fx && fresh) { sfx.bad(); buzz([30, 40, 30]); }
  if (!won && dogs.length === P.n && !bad.size) win();
}
function setMark(i, v, fx) {
  if (marks[i] === v) return false;
  marks[i] = v;
  const c = board.children[i];
  c.innerHTML = v === 2 ? DOG : v === 1 ? XM : '';
  c.setAttribute('aria-label', label(i));
  if (fx) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  return true;
}
function store() { S.marks[key] = marks.join(''); save(); }
function cycle(i) {
  if (won) return;
  const v = (marks[i] + 1) % 3;
  setMark(i, v, true);
  if (v === 1) { sfx.x(); buzz(8); } else if (v === 2) { sfx.dog(); buzz(15); } else { sfx.clear(); buzz(6); }
  refresh(); store();
}

/* touch: tap cycles, drag paints X (or erases X if the drag starts on an X) */
let drag = null;
const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest && el.closest('.cell') && board.contains(el) ? +el.closest('.cell').dataset.i : -1; };
board.addEventListener('pointerdown', e => {
  if (won || (e.button !== undefined && e.button > 0)) return;
  const i = cellAt(e.clientX, e.clientY); if (i < 0) return;
  ctx();
  drag = { start: i, last: i, moved: false, mode: marks[i] === 0 ? 'mark' : marks[i] === 1 ? 'erase' : null, id: e.pointerId };
  try { board.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
});
function paint(i) {
  if (drag.mode === 'mark' && marks[i] === 0 && setMark(i, 1, true)) { sfx.x(); buzz(5); }
  if (drag.mode === 'erase' && marks[i] === 1 && setMark(i, 0, false)) { sfx.clear(); buzz(4); }
}
board.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0 || i === drag.last) return;
  if (!drag.moved) { drag.moved = true; paint(drag.start); }
  drag.last = i; paint(i);
});
board.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved) cycle(drag.start); else { refresh(); store(); }
  drag = null;
});
board.addEventListener('pointercancel', () => { if (drag && drag.moved) { refresh(); store(); } drag = null; });
board.addEventListener('keydown', e => {
  const c = e.target.closest('.cell'); if (!c) return;
  const i = +c.dataset.i, n = P.n, mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[e.key];
  if (mv !== undefined) {
    const j = i + mv;
    if (j >= 0 && j < n * n && !(Math.abs(mv) === 1 && Math.floor(j / n) !== Math.floor(i / n))) { c.tabIndex = -1; board.children[j].tabIndex = 0; board.children[j].focus(); }
    e.preventDefault();
  } else if (e.key === ' ' || e.key === 'Enter') { ctx(); cycle(i); e.preventDefault(); }
});

/* ---------- game flow ---------- */
function open() {
  won = false;
  if (S.mode === 'levels') { P = puzzleFor(S.level * 104729 + 17, sizeFor(S.level)); key = 'L' + S.level; }
  else { const n = DIFFS[S.diff][1]; if (!S.endSeed) S.endSeed = 1 + Math.floor(Math.random() * 1e9); P = puzzleFor(S.endSeed, n); key = 'E' + n + ':' + S.endSeed; }
  const m = S.marks[key];
  marks = m && m.length === P.n * P.n ? m.split('').map(Number) : new Array(P.n * P.n).fill(0);
  const keep = {}; Object.keys(S.marks).forEach(k => { if (k === key || (k[0] === 'L' && !S.done.includes(+k.slice(1)))) keep[k] = S.marks[k]; }); S.marks = keep;
  ui(); build(); save();
}
function ui() {
  const lev = S.mode === 'levels';
  $('tLev').setAttribute('aria-pressed', lev); $('tEnd').setAttribute('aria-pressed', !lev);
  $('levRow').hidden = !lev; $('endRow').hidden = lev; $('newp').hidden = lev;
  const n = sizeFor(S.level);
  $('lvl').innerHTML = `Level ${S.level}<small>${n}×${n}${S.done.includes(S.level) ? ' · solved' : ''}</small>`;
  $('prev').disabled = S.level <= 1; $('next').disabled = S.level >= Math.min(LEVELS, unlocked());
  $('diffs').innerHTML = DIFFS.map(([name, n], i) => `<button class="chip" data-d="${i}" aria-pressed="${i === S.diff}">${name} <small>${n}×${n}</small></button>`).join('');
  const sb = $('snd');
  sb.setAttribute('aria-label', S.sound ? 'Mute sound' : 'Turn sound on');
  sb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${S.sound ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' : '<path d="M17 9l5 6M22 9l-5 6"/>'}</svg>`;
  $('oSnd').setAttribute('aria-checked', S.sound); $('oVib').setAttribute('aria-checked', S.vib);
}
const unlocked = () => Math.max(1, ...S.done.map(d => d + 1));
function win() {
  won = true;
  if (S.mode === 'levels') { if (!S.done.includes(S.level)) S.done.push(S.level); }
  else S.endWins[S.diff]++;
  delete S.marks[key]; save();
  sfx.win(); buzz([20, 40, 20, 40, 80]);
  const dogsEls = [...board.children].filter((c, i) => marks[i] === 2);
  dogsEls.forEach((c, k) => { c.querySelector('svg').style.animationDelay = (k * 0.08) + 's'; c.classList.add('hop'); });
  confetti();
  const lev = S.mode === 'levels';
  $('wSub').textContent = lev
    ? (S.level >= LEVELS ? `You solved all ${LEVELS} levels. Endless mode has more pups waiting.` : `Level ${S.level} solved. ${LEVELS - S.done.length} levels to go.`)
    : `${DIFFS[S.diff][0]} puzzle solved. That's ${S.endWins[S.diff]} at this difficulty.`;
  $('wNext').textContent = lev ? (S.level >= LEVELS ? 'Try Endless' : 'Next level') : 'New puzzle';
  $('wMenu').textContent = lev ? 'Levels' : 'Close';
  setTimeout(() => sheet('sWin', true), 1100);
  ui();
}
function sheet(id, on) { $(id).classList.toggle('open', on); if (!on && id === 'sHelp' && !S.seen) { S.seen = true; save(); } if (on) { const b = $(id).querySelector('.lb.cur') || $(id).querySelector('.main') || $(id).querySelector('[data-close]'); $(id).querySelector('.card').scrollTop = 0; b && b.focus({ preventScroll: true }); } }
document.querySelectorAll('.sheet').forEach(s => {
  s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) sheet(s.id, false); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.sheet.open').forEach(s => sheet(s.id, false)); });

$('tLev').onclick = () => { if (S.mode !== 'levels') { S.mode = 'levels'; open(); } };
$('tEnd').onclick = () => { if (S.mode !== 'endless') { S.mode = 'endless'; open(); } };
$('prev').onclick = () => { if (S.level > 1) { S.level--; open(); } };
$('next').onclick = () => { if (S.level < Math.min(LEVELS, unlocked())) { S.level++; open(); } };
$('diffs').onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; if (d !== S.diff) { S.diff = d; S.endSeed = 0; open(); } };
$('newp').onclick = () => { delete S.marks[key]; S.endSeed = 0; open(); };
$('clear').onclick = () => { if (!won && marks.some(v => v)) sheet('sClr', true); };
$('doClr').onclick = () => { marks.fill(0); build(); store(); sfx.clear(); sheet('sClr', false); };
$('help').onclick = () => sheet('sHelp', true);
$('snd').onclick = () => { S.sound = !S.sound; save(); ui(); if (S.sound) woof(); };
$('oSnd').onclick = () => { S.sound = !S.sound; save(); ui(); if (S.sound) woof(); };
$('oVib').onclick = () => { S.vib = !S.vib; save(); ui(); buzz(20); };
$('lvl').onclick = () => {
  const u = unlocked(), groups = [[5, 1, 4], [6, 5, 12], [7, 13, 22], [8, 23, 32], [9, 33, 40]];
  $('lSub').textContent = `${S.done.length} of ${LEVELS} solved. Solve a level to unlock the next.`;
  $('lgrid').innerHTML = groups.map(([n, a, b]) => `<h3>${n}×${n} park</h3>` + Array.from({ length: b - a + 1 }, (_, k) => {
    const l = a + k, d = S.done.includes(l);
    return `<button class="lb${d ? ' done' : ''}${l === S.level ? ' cur' : ''}" data-l="${l}" ${l > u ? 'disabled aria-label="Level ' + l + ', locked"' : 'aria-label="Level ' + l + (d ? ', solved' : '') + '"'}>${l}${d ? '<span class="ck">✓</span>' : ''}</button>`;
  }).join('')).join('');
  sheet('sLev', true);
};
$('lgrid').onclick = e => { const b = e.target.closest('[data-l]'); if (!b || b.disabled) return; S.level = +b.dataset.l; S.mode = 'levels'; sheet('sLev', false); open(); };
$('wNext').onclick = () => {
  sheet('sWin', false);
  if (S.mode === 'levels') { if (S.level >= LEVELS) S.mode = 'endless'; else S.level++; }
  else S.endSeed = 0;
  open();
};
$('wMenu').onclick = () => { sheet('sWin', false); if (S.mode === 'levels') $('lvl').onclick(); };

/* ---------- how-to minis ---------- */
function mini(el, n, reg, m) {
  el.style.gridTemplateColumns = el.style.gridTemplateRows = `repeat(${n},minmax(0,1fr))`;
  el.innerHTML = cellsHTML(n, reg, m);
}
mini($('m1'), 4, [0,0,1,1, 0,2,2,1, 3,3,2,1, 3,2,2,1], [0,2,0,0, 0,0,0,2, 2,0,0,0, 0,0,2,0]);
mini($('m2'), 3, [4,4,4, 4,4,4, 4,4,4], [1,1,1, 1,2,1, 1,1,1]);

/* ---------- confetti ---------- */
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('fx'), c = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--r0', '--r1', '--r2', '--r3', '--r4', '--r5', '--r6', '--acc'].map(v => { const t = document.createElement('i'); t.style.color = `var(${v})`; document.body.appendChild(t); const col = getComputedStyle(t).color; t.remove(); return col; });
  const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .45, vx: (Math.random() - .5) * 18 * dpr, vy: (-8 - Math.random() * 14) * dpr, r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6, va: (Math.random() - .5) * .3, col: cols[Math.floor(Math.random() * cols.length)], bone: Math.random() < .25 }));
  let t0 = performance.now();
  (function f(t) {
    c.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += .45 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col;
      if (p.bone) { const r = p.r * .55; c.fillRect(-p.r, -r / 2, p.r * 2, r); [[-p.r, -r / 2], [-p.r, r / 2], [p.r, -r / 2], [p.r, r / 2]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, r * .6, 0, 7); c.fill(); }); }
      else c.fillRect(-p.r / 2, -p.r, p.r, p.r * 2);
      c.restore();
    }
    if (t - t0 < 2800) requestAnimationFrame(f); else c.clearRect(0, 0, W, H);
  })(t0);
}

function start(d) {
  load(d);
  if (S.level > unlocked()) S.level = unlocked();
  open();
  if (!S.seen) sheet('sHelp', true);
}
/* ---------- installable app ---------- */
let deferredInstall = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installUI() {
  const can = !standalone() && (deferredInstall || isIOS);
  $('getApp').hidden = !can;
  $('inst').hidden = !can;
  $('instBtn').hidden = !deferredInstall;
  if (!deferredInstall && isIOS) $('instTxt').innerHTML = 'In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. It plays full screen, even offline.';
}
async function install() {
  if (!deferredInstall) { sheet('sHelp', true); $('inst').scrollIntoView({ block: 'nearest' }); return; }
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch (e) {}
  deferredInstall = null; installUI();
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; installUI(); });
addEventListener('appinstalled', () => { deferredInstall = null; installUI(); });
$('getApp').onclick = install;
$('instBtn').onclick = install;
installUI();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

start({});
}
