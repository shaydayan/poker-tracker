# Poker Tracker

Personal app for tracking a weekly home game: capture every hand with one tap per player per street, then see statistics and insights about yourself and each regular.

## Stack and stages

A **Progressive Web App (PWA)**: React + Vite + Tailwind, installed on the phone from Chrome ("Add to Home screen"). Data lives on the device; no server is needed during a game.

| Stage | What | Status |
|-------|------|--------|
| 1 | Mock capture UI on the Mac, in-memory data | done |
| 2 | Real on-device storage (IndexedDB), backup file | done |
| 2b | Stats screens, computed from the saved actions of every session so far | later |
| 3 | Install on the Android phone as a PWA | done: https://shaydayan.github.io/poker-tracker/ |
| 4 | Optional: native package via Capacitor, only if the PWA falls short | |

## Run on the Mac

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 (your real data, kept in the browser), or http://localhost:5173/?demo for throwaway sample data that is gone on reload. Use the browser's device toolbar (Chrome: DevTools → toggle device toolbar) to view it at phone width.

Try the built app (the same static files a host would serve, no Vite dev server):

```bash
cd frontend && npm run build && npm run preview -- --port 4173
```

Open http://localhost:4173. It keeps its own data, separate from the dev server's on port 5173.

## Installing on the phone

The build is an installable web app (PWA):

- `public/manifest.webmanifest`: the name ("Poker Tracker" / "Poker" under the icon), colours, full-screen portrait.
- `public/icons/`: the spade icon in the sizes Android uses, plus a maskable version for round or squircle masks. They're drawn by `python3 scripts/make-icons.py public/icons` (no image tools needed).
- `dist/sw.js`: the offline cache, written at build time by `scripts/offline-cache.js`. It lists every built file, so the whole app is cached on the first visit and opens with no signal. Its name comes from a hash of the build, so a new build replaces the old cache the next time the app is opened online. It caches only the app's files; your data stays in IndexedDB.
- `base: './'` in `vite.config.js`: every built path is relative, so the same build works at a site's root or under a sub-path.

To install: open https://shaydayan.github.io/poker-tracker/ in Chrome on the phone, then menu → **Install app** (or Add to Home screen). Installing needs HTTPS, so it works from the published address, not from the Mac's Wi-Fi address.

## Publishing

The code is at https://github.com/shaydayan/poker-tracker (public; it holds no data). Every push to `main` runs `.github/workflows/pages.yml`: tests, build, then publish `frontend/dist` to GitHub Pages. A failing test stops the publish. An installed app picks up the new version the next time it is opened online. Data on the phone is never touched by a publish.

Tests (domain logic only):

```bash
cd frontend && npm test
```

## Screens

Four tabs along the top:

- **Settings** — your name (saved as you type; on a fresh app it's the first thing to fill in), blinds, straddle, default raise sizes (open raise, open over a straddle, 3-bet ×, 4-bet+ ×, postflop raise ×), the other players (you're not in that list) and backup. Every change saves on the spot.
- **History** — every finished session; tap one to see its hands (one line each, naming who raised and who called), and tap a hand to see it street by street. Long-press a session or a hand to delete it (asks first; a session goes with all its hands; this can't be undone).
- **Session** — with no session running: the New Session page, a transfer list: on the left the table in seat order (you first, then clockwise), on the right the players not seated yet. Tapping a name on the right seats them at the next seat; tapping one on the left (✕) sends them back to their place in the right-hand list; "+ Guest" asks for a name (left empty, it is the first free "Guest N") and seats them. Player names are unique (ignoring case and spaces): Settings and the guest sheet refuse a name already in use. With a session running: its hands so far, one line each ("Tal raises to 25, Shay, Dani call · Flop: Tal bets 40 · Tal wins 120"; tap one to reopen it on the Hand tab; long-press one to delete it, which Undo on the Hand tab reverses) and End Session.
- **Hand** — the hand being captured. A half-captured hand survives switching tabs.

## Capturing a hand

The table is the input. The **seat map** sits at the top, under the tabs, with the hand's log below it and the current question under the log: you at the bottom, the others clockwise, the dealer marked **D**, and the board in the middle: five card places, filled as the flop (3), turn (4) and river (5) are dealt, with the street and pot under them. Tap the board to pick its actual cards (optional): a 13×4 picker, cards in the order dealt (3 for the flop, then the turn, then the river), changeable any time; they show on the board, in the log and in the history ("Flop: J♥ 7♣ 2♦ · Checked through").

1. **Sitting Out** is the first row of every hand: who sits this hand out ("Nobody", or their names), carried over from the hand before, so it costs no tap. They stay on the table faded and marked Out, and the hand is played without them. You can sit out too; the hand is still recorded ("You sit out" in the header). Change it from the **⋯** menu (this hand while nothing else is entered, otherwise from the next hand), or tap the row to change this hand, saved hands included: the rows after it come back if they still fit. At least two must play.
2. **Dealer?** The seat expected to hold the button (after the previous hand) is highlighted, and its name is a button on the question's line; tap that, or any seat.
3. The seat to act is lit and the controls say what they can do: **Fold**, **Check** or **Call N**, **Bet** or **Raise** (slider), and **Straddle** for the first player preflop. Each seat shows what it did this street (SB, BB, Str 10, Fold, Check, Call 25, Raise 75, Bet 40); folded seats fade out.
4. Tapping a later seat acts for them and resolves the seats in between in one go: they fold when facing a bet, check otherwise ("Roni, Gil fold · Tal raises to 25").
5. **End Street** does the same for everyone still to act: who can check checks, who faces a bet folds, and the next street is dealt (after the river, the hand goes to the cards). **End Hand**, beside it, stops the betting where it is.
6. When one player is left, after the river, or after End Hand, the hand goes to **Cards Shown?**: tap any player and pick their two exact cards on the same 13×4 card picker as the board (in a sheet over the screen; cards already on the board or in another hand are greyed out), for as many players as showed. Cancel closes it. The cards show face up beside the player's seat, like the board, so the seat keeps its own text. Stats keep the hand as its notation (A♥ K♦ → AKo).
7. **Save Hand** (under Cards Shown?) moves the button and deals the next hand. The header's Hand number says how many are done (Hand 5 = four saved).

The log between the table and the controls reads like the hand: one row per outcome, players who did the same thing in a row merged ("Roni, Gil, Tal fold", "Shay, Dani call 25"), each bet or raise on its own row, and each street's board as one row with the cards in effect. Tap a board row to change the cards. Tap any other row (↺) to enter it again from its first entry: the rows after it wait faded below and come back once it is done, as long as they still fit (the first one that no longer fits is dropped, with everything after it). Each betting action keeps the street it was taken on, so after an edit it is dropped rather than moved to another street (a flop bet never comes back as a preflop re-raise); tap the old row (↩) to keep it as it was. This works the same on a saved hand reopened from the Session tab. **Undo** (↶, top right, beside ⋯) steps back one change of any kind (an action, saving or skipping a hand, sitting a player out, opening or saving a past hand), up to 200 steps back; undoing a save takes the hand out of the saved list again.

Saved hands keep their table actions; the session and history lines are built from them. The actions are also mapped onto a question-based model of the hand (each raise with the callers before it, a street's first bet, the closing round of every street), which is kept with each saved hand for stats.

Raise slider: the steps are 1 big blind at the start, then 2, then 4 and so on, so the amount is always a multiple of the big blind. Defaults: open raise from settings (bigger over a straddle), 3-bet 3x the raise, 4-bet and above 2x; after the flop a bet is half the pot and a raise is 2x the bet.

Your own cards are the ones you enter for your seat under Cards Shown? (optional); the hand lists show them as notation ("#2 QQ"). The **⋯** menu sits a player (or you) out or back in. Reopening a saved hand (from the Session tab) loads its actions, to change row by row; Save or Cancel returns to the hand in progress.

## Architecture (frontend)

One module, layers point inward to the domain:

```
src/
  domain/      pure: positions, table engine (actions, history lines), hand model for stats (actions → answers), saved-hand record, session, players, cards, ports   ← tests live here
  app/         view-state hooks that drive the domain and call the ports
  storage/     adapters implementing the ports: IndexedDB (the real one), in-memory with sample data (tests and ?demo)
  components/  shared, domain-agnostic UI controls (see components/README.md)
  screens/     presentation
  main.jsx     composition root: wires the storage adapter into the app
```

All persistence goes through the ports in `src/domain/ports.js`; nothing else touches storage.

## Keeping the data

Data lives in IndexedDB on the device (`src/storage/indexeddb.js`), so a hand survives closing the app, the phone restarting, and app updates.

- **Saved hands keep the raw table actions** (who did what, on which street), the board and the cards shown. Stats added later are computed from these actions, so they cover every session captured before them; nothing a later stat needs is thrown away.
- **Every saved hand carries a `format` number** (now 2: the hand's base lists everyone at the table and a first 'seats' action says who sat out; format-1 hands, without it, read as everyone playing) (`HAND_FORMAT` in `domain/record.js`), and the database has a schema version. A change to either must keep reading what was saved before: bump the number and add a migration; never drop or rewrite stored hands.
- **The hand in progress is saved on every tap** as a draft for its session, and comes back when the app is opened again.
- **Writes count only once committed** (strict durability), and the app asks the browser to keep its data even when space runs low.
- **Backup** (Settings): Export saves everything as one JSON file (`poker-tracker-YYYY-MM-DD.json`; keep it in Drive or email it); Import shows what a file holds and, on confirm, replaces everything on the device with it. The backup file has its own `format` number; newer versions of the app keep reading older files.
