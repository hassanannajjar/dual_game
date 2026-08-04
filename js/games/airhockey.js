const R = 0.085, PR = 0.045, MAXSCORE = 7, SPEED = 0.03;
const M = { host: false, cv: null, g: null, size: 0, puck: null, hp: null, gp: null, sHost: 0, sGuest: 0, mine: null, state: null, raf: null, frame: 0, ptr: null };

function resetPuck(dir) { M.puck = { x: 0.5, y: 0.5, vx: (Math.random() - 0.5) * 0.012, vy: dir * 0.014 }; }
function physics() {
  const p = M.puck;
  p.x += p.vx; p.y += p.vy;
  if (p.x < PR) { p.x = PR; p.vx = Math.abs(p.vx); }
  if (p.x > 1 - PR) { p.x = 1 - PR; p.vx = -Math.abs(p.vx); }
  for (const pad of [M.hp, M.gp]) {
    const dx = p.x - pad.x, dy = p.y - pad.y, d = Math.hypot(dx, dy);
    if (d < PR + R && d > 0) { const nx = dx / d, ny = dy / d; p.x = pad.x + nx * (PR + R); p.y = pad.y + ny * (PR + R); const sp = Math.max(Math.hypot(p.vx, p.vy), 0.013); p.vx = nx * sp * 1.06; p.vy = ny * sp * 1.06; }
  }
  const sp = Math.hypot(p.vx, p.vy); if (sp > SPEED) { p.vx *= SPEED / sp; p.vy *= SPEED / sp; }
  if (p.y < 0) { M.sHost++; hit(); resetPuck(1); }
  else if (p.y > 1) { M.sGuest++; hit(); resetPuck(-1); }
}
function hit() { try { M._ctx.sound('drop'); } catch (e) {} }
function draw() {
  const g = M.g, s = M.size; g.clearRect(0, 0, s, s * 1.5);
  g.fillStyle = '#0f172a'; g.fillRect(0, 0, s, s * 1.5);
  g.strokeStyle = '#334155'; g.beginPath(); g.moveTo(0, s * 0.75); g.lineTo(s, s * 0.75); g.stroke();
  g.beginPath(); g.arc(s / 2, s * 0.75, s * 0.14, 0, 7); g.stroke();
  let puck, myPad, oppPad, top, bot;
  if (M.host) { puck = M.puck; myPad = M.hp; oppPad = M.gp; bot = M.sHost; top = M.sGuest; }
  else { const st = M.state || { px: 0.5, py: 0.5, hp: { x: 0.5, y: 0.9 } }; puck = { x: 1 - st.px, y: 1 - st.py }; oppPad = { x: 1 - st.hp.x, y: 1 - st.hp.y }; myPad = M.mine; bot = M.state ? M.state.sGuest : 0; top = M.state ? M.state.sHost : 0; }
  const px = (v) => v * s, py = (v) => v * s * 1.5;
  const disc = (p, col) => { g.fillStyle = col; g.beginPath(); g.arc(px(p.x), py(p.y), s * R, 0, 7); g.fill(); };
  disc(oppPad, '#f59e0b'); disc(myPad, '#10b981');
  g.fillStyle = '#e2e8f0'; g.beginPath(); g.arc(px(puck.x), py(puck.y), s * PR, 0, 7); g.fill();
  g.fillStyle = '#94a3b8'; g.font = `${Math.round(s * 0.08)}px sans-serif`; g.textAlign = 'center';
  g.fillText(String(top), s / 2, s * 0.12); g.fillText(String(bot), s / 2, s * 1.45);
}
function loop(ctx) {
  if (M.host) {
    physics();
    if ((M.frame++ % 2) === 0) ctx.send('state', { px: M.puck.x, py: M.puck.y, hp: M.hp, sHost: M.sHost, sGuest: M.sGuest });
    if (M.sHost >= MAXSCORE || M.sGuest >= MAXSCORE) { const hostWon = M.sHost > M.sGuest; ctx.send('over', { hostWon }); ctx.endGame(hostWon ? 'win' : 'lose', `${M.sHost}–${M.sGuest}`); return; }
  }
  draw();
  M.raf = requestAnimationFrame(() => loop(ctx));
}
function build(ctx) {
  const wrap = ctx.el('div', 'mx-auto text-center space-y-2');
  const cv = document.createElement('canvas');
  const size = Math.min(window.innerWidth * 0.9, 300);
  cv.width = size; cv.height = size * 1.5;
  cv.style.width = 'min(90vw, 300px)'; cv.style.touchAction = 'none';
  cv.className = 'rounded-xl border border-slate-700 mx-auto block';
  M.cv = cv; M.g = cv.getContext('2d'); M.size = size;
  wrap.appendChild(cv);
  wrap.appendChild(ctx.el('p', 'text-slate-500 text-xs', 'Drag your paddle (bottom)'));
  ctx.root.appendChild(wrap);
  M.ptr = (e) => {
    const r = cv.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    x = Math.max(R, Math.min(1 - R, x)); y = Math.max(0.5, Math.min(1 - R, y));   // bottom half
    if (M.host) { M.hp.x = x; M.hp.y = y; }
    else { M.mine = { x, y }; ctx.send('paddle', { x: 1 - x, y: 1 - y }); }
    e.preventDefault();
  };
  cv.addEventListener('pointermove', M.ptr);
  cv.addEventListener('pointerdown', M.ptr);
}

export default {
  id: 'airhockey', name: 'Air Hockey', emoji: '🏒', blurb: 'Fast paddle duel', usesTurns: false, realtime: true,
  start(ctx) {
    M._ctx = ctx; M.host = ctx.isHost; M.sHost = 0; M.sGuest = 0; M.frame = 0; M.state = null;
    M.hp = { x: 0.5, y: 0.9 }; M.gp = { x: 0.5, y: 0.1 }; M.mine = { x: 0.5, y: 0.9 };
    resetPuck(Math.random() < 0.5 ? 1 : -1);
    build(ctx);
    loop(ctx);
  },
  // Bot controls the top paddle (M.gp, host coords). Tracks the puck's x; advances to clear
  // it when it's in the top half. easy adds aim jitter; hard is precise.
  botOnGame(msg, send, level) {
    if (msg.type !== 'state') return;
    let tx = msg.px, ty = 0.12;
    if (msg.py < 0.4) ty = Math.max(R, msg.py - 0.04);          // step onto an incoming puck
    const jitter = level === 'easy' ? 0.12 : level === 'medium' ? 0.04 : 0;
    tx += (Math.random() - 0.5) * jitter * 2;
    tx = Math.max(R, Math.min(1 - R, tx)); ty = Math.max(R, Math.min(0.5, ty));
    send({ type: 'paddle', x: tx, y: ty });
  },
  onMessage(msg, ctx) {
    if (msg.type === 'paddle') { if (M.host) M.gp = { x: msg.x, y: msg.y }; }       // host: guest paddle in host coords
    else if (msg.type === 'state') { M.state = msg; }                               // guest: render snapshot
    else if (msg.type === 'over') ctx.endGame(msg.hostWon ? 'lose' : 'win');         // guest side
  },
  stop() { if (M.raf) cancelAnimationFrame(M.raf); M.raf = null; if (M.cv && M.ptr) { M.cv.removeEventListener('pointermove', M.ptr); M.cv.removeEventListener('pointerdown', M.ptr); } },
  getState() { return null; },
  restore(_, ctx) { this.start(ctx); },
};
