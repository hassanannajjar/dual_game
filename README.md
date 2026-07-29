# Arcade — 2-Player Games

A small **platform of 2-player games** that runs entirely in the browser and connects the two players **peer-to-peer over WebRTC (PeerJS)** — there is **no server to host**. Deploys straight to GitHub Pages.

Games included: **Number Duel** (Bulls & Cows), **Tic-Tac-Toe**, **Connect Four**, **Rock Paper Scissors**, **Battleship**.

For guessing games (Number Duel) and hidden-board games (Battleship), your secret **never leaves your device** — your browser only sends feedback about the opponent's moves.

## Play

1. On the home grid, **pick a game**.
2. **Host** clicks **Create a Room**, sets options, and shares the **room code** or **Copy invite link**.
3. **Opponent** opens the link (or picks the same game, enters the code, and clicks **Join Room**).
4. Follow the game (set a secret / place ships where needed), then a coin toss picks who's first. Play, rematch, or head back to pick another game.

Invite links look like `…/?g=<game>&room=<CODE>` and deep-link straight into the right game.

## Run locally

ES modules + WebRTC need `http://localhost` (not `file://`). From this folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` in two browser windows to test both sides.

Run the pure-logic self-check:

```bash
node test.mjs
```

## Deploy to GitHub Pages

1. Push these files to the repo's default branch (`main`).
2. GitHub → **Settings → Pages → Build and deployment** → *Deploy from a branch* → **`main`** / **`/ (root)`** → Save.
3. Live at `https://<user>.github.io/<repo>/` (e.g. `https://hassanannajjar.github.io/dual_game/`).

No build step — Tailwind and PeerJS load from CDNs and the browser loads the ES modules directly.

## Project layout

```
index.html            # shell markup (screens + containers)
app.css               # small neon-theme extras on top of Tailwind CDN
js/
  platform.js         # engine: connection, lobby, coin toss, turns, timer, game-over
  logic.js            # pure rules (evaluate, ticTacToeWinner, connectFourWinner)
  games/*.js          # one file per game
  app.js              # imports + registers every game, boots
test.mjs              # node self-check for logic.js
```

## Add a new game

1. Create `js/games/<id>.js` exporting a game definition:

   ```js
   export default {
     id: 'my-game', name: 'My Game', emoji: '🎲', blurb: 'One-liner',
     // usesTurns: false,           // for simultaneous games (no coin toss / timer)
     // options: [{ key, label, choices:[{label,value}], default }],
     // setup(ctx) { ... ctx.ready() when locked },   // optional secret/placement phase
     start(ctx, { iAmFirst }) { /* render into ctx.root */ },
     onMessage(msg, ctx) { /* handle moves */ },
     // onTurn(mine, ctx) {}, onTimeout(ctx) {},       // optional
   };
   ```

2. Import and register it in `js/app.js` (add it to the array). Done — no engine changes needed.

`ctx` gives you: `root`, `setupRoot`, `isHost`, `config`, `myTurn`, `el()`, `toast()`, `elapsed()`, `send(type, payload)`, `setTurn(mine)`, `ready()`, `endGame('win'|'lose'|'draw', msg)`.

## Known limits

- **Strict NATs:** the free PeerJS broker has no TURN relay, so some corporate/mobile networks may fail to connect. Add a TURN server (or switch transport to Firebase) if you hit this.
- **Trust:** peer-to-peer with no referee — assumes both players run an unmodified client. Fine for casual play.
- **No reconnection:** if a player drops, the match ends; start a new room.
- **Battleship** uses random ship placement (with a Shuffle button); manual placement is a future add.
