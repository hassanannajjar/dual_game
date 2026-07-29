// Pure Bulls & Cows evaluator. Works in the browser (attaches to window)
// and in Node (module.exports) — no build step.
(function (root) {
  // secret & guess are equal-length strings of digits. Repeats allowed.
  // exact  = right digit, right position (bulls)
  // partial = right digit, wrong position (cows), counted with digit frequencies
  function evaluate(secret, guess) {
    if (secret.length !== guess.length) throw new Error('length mismatch');
    let exact = 0;
    const secretRest = {}; // digit -> count, excluding exact matches
    const guessRest = [];
    for (let i = 0; i < secret.length; i++) {
      if (guess[i] === secret[i]) {
        exact++;
      } else {
        secretRest[secret[i]] = (secretRest[secret[i]] || 0) + 1;
        guessRest.push(guess[i]);
      }
    }
    let partial = 0;
    for (const d of guessRest) {
      if (secretRest[d] > 0) {
        partial++;
        secretRest[d]--;
      }
    }
    return { exact, partial };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { evaluate };
  else root.evaluate = evaluate;
})(typeof window !== 'undefined' ? window : this);
