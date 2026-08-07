import { SIM_EDGES, SIM_TRIS, simKey, simLoser } from '../logic.js?v=46';

const M = { edges: {}, mine: 'A', opp: 'B', lines: {}, msgEl: null };
const NODES = Array.from({ length: 6 }, (_, i) => { const a = (-90 + i * 60) * Math.PI / 180; return [50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)]; });
const color = (c) => (c === 'A' ? '#10b981' : c === 'B' ? '#f59e0b' : '#334155');

function paint(ctx) {
  for (const [a, b] of SIM_EDGES) { const k = simKey(a, b); M.lines[k].setAttribute('stroke', color(M.edges[k])); M.lines[k].setAttribute('stroke-width', M.edges[k] ? '1.8' : '1'); }
  if (M.msgEl) M.msgEl.textContent = ctx.myTurn ? 'Claim an edge — avoid a triangle in your colour' : 'Opponent…';
}
function build(ctx) {
  M.lines = {};
  const wrap = ctx.el('div', 'mx-auto'); wrap.style.maxWidth = 'min(92vw, 24rem)';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'w-full');
  for (const [a, b] of SIM_EDGES) {
    const mk = (w, stroke) => { const ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', NODES[a][0]); ln.setAttribute('y1', NODES[a][1]); ln.setAttribute('x2', NODES[b][0]); ln.setAttribute('y2', NODES[b][1]); ln.setAttribute('stroke', stroke); ln.setAttribute('stroke-width', w); ln.setAttribute('stroke-linecap', 'round'); return ln; };
    const ln = mk('1', '#334155');
    const hit = mk('5', 'transparent'); hit.style.cursor = 'pointer';
    const k = simKey(a, b); M.lines[k] = ln; hit.onclick = () => claim(ctx, k);
    svg.appendChild(ln); svg.appendChild(hit);
  }
  for (const [x, y] of NODES) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '3.2'); c.setAttribute('fill', '#e2e8f0'); svg.appendChild(c); }
  wrap.appendChild(svg);
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mt-2'); wrap.appendChild(M.msgEl);
  ctx.root.appendChild(wrap); paint(ctx);
}
function claim(ctx, k) {
  if (!ctx.myTurn || M.edges[k]) return;
  M.edges[k] = M.mine; ctx.sound('place'); ctx.send('edge', { k }); paint(ctx);
  if (simLoser(M.edges) === M.mine) return ctx.endGame('lose', 'You formed a triangle');
  if (Object.keys(M.edges).length === 15) return ctx.endGame('draw');
  ctx.setTurn(false);
}

export default {
  id: 'sim', name: 'Sim', emoji: '⬡', blurb: 'Avoid the triangle',
  start(ctx, { iAmFirst }) { M.edges = {}; M.mine = iAmFirst ? 'A' : 'B'; M.opp = iAmFirst ? 'B' : 'A'; build(ctx); },
  onTurn(mine, ctx) { paint(ctx); },
  botMove(level) {
    const free = SIM_EDGES.map(([a, b]) => simKey(a, b)).filter((k) => !M.edges[k]);
    if (!free.length) return null;
    const safe = free.filter((k) => simLoser(Object.assign({}, M.edges, { [k]: M.opp })) !== M.opp);
    const pool = safe.length ? safe : free;
    if (level !== 'easy' && safe.length) {          // prefer safe edges that build the fewest 2-in-a-triangle threats
      let best = pool[0], bs = 1e9;
      for (const k of pool) {
        const t = Object.assign({}, M.edges, { [k]: M.opp }); let threat = 0;
        for (const [i, j, l] of SIM_TRIS) { const es = [simKey(i, j), simKey(i, l), simKey(j, l)]; if (es.filter((e) => t[e] === M.opp).length === 2 && es.filter((e) => t[e] === M.mine).length === 0) threat++; }
        if (threat < bs) { bs = threat; best = k; }
      }
      return { type: 'edge', k: best };
    }
    return { type: 'edge', k: pool[Math.floor(Math.random() * pool.length)] };
  },
  onMessage(msg, ctx) {
    if (msg.type !== 'edge') return;
    M.edges[msg.k] = M.opp; ctx.sound('place'); paint(ctx);
    if (simLoser(M.edges) === M.opp) return ctx.endGame('win', 'Opponent formed a triangle');
    if (Object.keys(M.edges).length === 15) return ctx.endGame('draw');
    ctx.setTurn(true);
  },
  getState() { return { edges: M.edges, mine: M.mine, opp: M.opp }; },
  restore(s, ctx) { M.edges = s.edges; M.mine = s.mine; M.opp = s.opp; build(ctx); },
};
