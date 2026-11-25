// Run with: node tests/engine.test.js
// Checks that every level, and a batch of endless puzzles, has exactly one solution.
const WD = require('../js/engine.js');
const sizeFor = l => l <= 4 ? 5 : l <= 12 ? 6 : l <= 22 ? 7 : l <= 32 ? 8 : 9;
let failures = 0;
function check(label, n, p) {
  if (!p) { console.error(`✗ ${label}: generator gave up`); failures++; return; }
  if (WD.countSolutions(n, p.reg, 3) !== 1) { console.error(`✗ ${label}: not unique`); failures++; }
  const rows = new Set(), cols = new Set(), regs = new Set();
  for (const i of p.sol) { rows.add(Math.floor(i / n)); cols.add(i % n); regs.add(p.reg[i]); }
  if (rows.size !== n || cols.size !== n || regs.size !== n) { console.error(`✗ ${label}: bad solution`); failures++; }
}
for (let l = 1; l <= 40; l++) check(`level ${l}`, sizeFor(l), WD.make(sizeFor(l), l * 104729 + 17));
for (const n of [6, 7, 8, 9]) for (let k = 0; k < 10; k++) check(`endless ${n}x${n} #${k}`, n, WD.make(n, 1 + k * 7919 + n));
console.log(failures ? `${failures} failure(s)` : 'All puzzles have exactly one solution ✓');
process.exit(failures ? 1 : 0);
