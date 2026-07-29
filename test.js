// Self-check for evaluate.js. Run: node test.js
const assert = require('assert');
const { evaluate } = require('./evaluate');

const cases = [
  ['1234', '1234', { exact: 4, partial: 0 }], // full win
  ['1234', '4321', { exact: 0, partial: 4 }], // all present, all misplaced
  ['1234', '5678', { exact: 0, partial: 0 }], // nothing
  ['1234', '1243', { exact: 2, partial: 2 }], // mixed
  ['1122', '2211', { exact: 0, partial: 4 }], // duplicates, all misplaced
  ['1122', '1111', { exact: 2, partial: 0 }], // dup in guess capped by secret count
  ['1112', '1211', { exact: 2, partial: 2 }], // dup frequency correctness
  ['051', '510', { exact: 0, partial: 3 }],   // leading zero handled as char
];

for (const [secret, guess, want] of cases) {
  const got = evaluate(secret, guess);
  assert.deepStrictEqual(got, want, `evaluate(${secret}, ${guess}) -> ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

assert.throws(() => evaluate('12', '123'), /length mismatch/);

console.log(`PASS (${cases.length} cases)`);
