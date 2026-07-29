# Number Duel

A 2-player number-guessing duel (Bulls & Cows). Each player picks a secret number; take turns guessing the opponent's. Feedback shows **exact** (right digit, right spot) and **partial** (right digit, wrong spot) counts. First to crack the opponent's number wins.

Runs entirely in the browser and connects the two players **peer-to-peer over WebRTC (PeerJS)** — there is **no server to host**. Your secret never leaves your device; your browser only sends feedback about the opponent's guesses.

## Play

1. **Host** clicks **Create a Room**, picks number length + turn timer, and shares the **room code** or **Copy invite link**.
2. **Opponent** opens the link (or enters the code and clicks **Join Room**).
3. Both enter a secret number and lock it in.
4. A coin toss picks who goes first, then take turns guessing. Beat the clock each turn.

## Run locally

WebRTC needs `http://localhost` (not `file://`). From this folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` in two browser windows to test both sides.

Run the evaluator self-check:

```bash
node test.js
```

## Deploy to GitHub Pages

1. Push these files to the repo's default branch (`main`).
2. GitHub → **Settings → Pages → Build and deployment** → *Deploy from a branch* → **`main`** / **`/ (root)`** → Save.
3. Live at `https://<user>.github.io/<repo>/` (e.g. `https://hassanannajjar.github.io/dual_game/`).

Invite links automatically include the repo path, so sharing just works.

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI (Tailwind CDN + PeerJS CDN), all screens |
| `game.js` | connection, state machine, timer, rendering |
| `evaluate.js` | pure Bulls & Cows evaluator (browser + Node) |
| `test.js` | `node test.js` self-check |

## Known limits

- **Strict NATs:** the free PeerJS broker has no TURN relay, so some corporate/mobile networks may fail to connect. Add a TURN server (or switch transport to Firebase) if you hit this.
- **Trust:** connection is peer-to-peer with no referee, so it assumes both players run an unmodified client. Fine for casual play.
- **No reconnection:** if a player drops, the match ends and you start a new room.
