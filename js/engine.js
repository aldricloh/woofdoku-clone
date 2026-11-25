/* Woofdoku engine: seeded generator with a unique-solution guarantee */
const WD = (() => {
  function rng(seed) {
    let s = Math.abs(Math.floor(seed)) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = s * 16807 % 2147483647) / 2147483647;
  }
  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function orth(i, n) {
    const y = Math.floor(i / n), x = i % n, out = [];
    if (y > 0) out.push(i - n);
    if (y < n - 1) out.push(i + n);
    if (x > 0) out.push(i - 1);
    if (x < n - 1) out.push(i + 1);
    return out;
  }
  function placeDogs(n, r) {
    const cols = [], used = new Array(n).fill(false);
    function bt(row) {
      if (row === n) return true;
      for (const c of shuffle([...Array(n).keys()], r)) {
        if (used[c] || (row > 0 && Math.abs(c - cols[row - 1]) < 2)) continue;
        used[c] = true; cols[row] = c;
        if (bt(row + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    bt(0);
    return cols;
  }
  function growRegions(n, cols, r) {
    const reg = new Array(n * n).fill(-1);
    cols.forEach((c, row) => { reg[row * n + c] = row; });
    const w = cols.map(() => 0.25 + r() * 1.75);
    let left = n * n - n;
    while (left > 0) {
      const fronts = cols.map(() => []);
      for (let i = 0; i < n * n; i++) {
        if (reg[i] >= 0) continue;
        for (const j of orth(i, n)) if (reg[j] >= 0) fronts[reg[j]].push(i);
      }
      let total = 0;
      fronts.forEach((f, g) => { if (f.length) total += w[g]; });
      let pick = r() * total, g = 0;
      for (; g < n; g++) {
        if (!fronts[g].length) continue;
        pick -= w[g];
        if (pick <= 0) break;
      }
      if (g >= n) g = fronts.findIndex(f => f.length);
      const f = fronts[g];
      reg[f[Math.floor(r() * f.length)]] = g;
      left--;
    }
    return reg;
  }
  function countSolutions(n, reg, cap) {
    let count = 0;
    const uc = new Uint8Array(n), ug = new Uint8Array(n);
    (function bt(row, prev) {
      if (row === n) { count++; return; }
      for (let c = 0; c < n && count < cap; c++) {
        if (uc[c] || (prev >= 0 && Math.abs(c - prev) < 2)) continue;
        const g = reg[row * n + c];
        if (ug[g]) continue;
        uc[c] = ug[g] = 1;
        bt(row + 1, c);
        uc[c] = ug[g] = 0;
      }
    })(0, -1);
    return count;
  }
  function connected(n, reg, g, start) {
    const seen = new Set([start]), st = [start];
    while (st.length) {
      const i = st.pop();
      for (const j of orth(i, n)) if (reg[j] === g && !seen.has(j)) { seen.add(j); st.push(j); }
    }
    let size = 0;
    for (const v of reg) if (v === g) size++;
    return seen.size === size;
  }
  function make(n, seed) {
    const r = rng(seed);
    for (let attempt = 0; attempt < 60; attempt++) {
      const cols = placeDogs(n, r);
      const dogCell = cols.map((c, row) => row * n + c);
      const isDog = new Set(dogCell);
      let reg = growRegions(n, cols, r);
      let cnt = countSolutions(n, reg, 40);
      for (let it = 0; it < 3000 && cnt > 1; it++) {
        const i = Math.floor(r() * n * n);
        if (isDog.has(i)) continue;
        const nb = orth(i, n).filter(j => reg[j] !== reg[i]);
        if (!nb.length) continue;
        const from = reg[i], to = reg[nb[Math.floor(r() * nb.length)]];
        const next = reg.slice();
        next[i] = to;
        if (!connected(n, next, from, dogCell[from])) continue;
        const c2 = countSolutions(n, next, 40);
        if (c2 <= cnt) { reg = next; cnt = c2; }
      }
      if (cnt === 1) {
        // shuffle region ids so colours don't follow row order
        const perm = shuffle([...Array(n).keys()], r);
        return { n, reg: reg.map(g => perm[g]), sol: dogCell };
      }
    }
    return null;
  }
  return { make, countSolutions, rng };
})();
if (typeof module !== 'undefined') module.exports = WD;
