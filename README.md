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
- **History** — every finished session; tap one to see its hands, and tap a hand to see it street by street. **Filter** (top right, with a session open) narrows its hands, to compare them: chosen players **In Hand** (put chips in), who **Raised** or who **Showed**; the **Dealer** (tap again to clear); the pot type (Limped, Raised, 3-Bet+); the pot size (100+, 300+, 500+); **Cards Shown**; **With Notes**. It applies as you tap, stays when you open another session, and the subtitle shows how many hands match.

Each hand gets one line, in the Session tab and in History: the last raise preflop ("Kuta 3-bets 340"; "Straddle 10" or "Limped" when nobody raised), how many saw the flop, how it ended with the pot ("turn, pot 695", "Idan wins 85 on the flop", "showdown, pot 300"), and the cards shown ("Shay J♥J♠ vs Kuta 8♥8♠"); ✎ after the hand number marks a note. Street by street (the dealer first), each street names only who bet or raised, then who called the last bet (by name when one or two, else "4 call"); folds, checks and limpers' names are left out, and a street with no bet reads "Checked". **Edit Hand** under it opens it on the Hand screen to change it like a hand of the session in progress (rows, cards, note, Undo); Save Changes or Cancel comes back to History. Long-press a session or a hand to delete it (asks first; a session goes with all its hands; this can't be undone).
- **Session** — with no session running: the New Session page, a transfer list: on the left the table in seat order (you first, then clockwise), on the right the players not seated yet. Tapping a name on the right seats them at the next seat; tapping one on the left (✕) sends them back to their place in the right-hand list; "+ Guest" asks for a name (left empty, it is the first free "Guest N") and seats them. Player names are unique (ignoring case and spaces): Settings and the guest sheet refuse a name already in use. With a session running: its hands so far, one line each ("Tal raises to 25, Shay, Dani call · Flop: Tal bets 40 · Tal wins 120"; tap one to reopen it on the Hand tab; long-press one to delete it, which Undo on the Hand tab reverses) and End Session.
- **Hand** — the hand being captured. A half-captured hand survives switching tabs.

## Capturing a hand

**Two views of the Hand screen** (switch with the ☰ / ◎ button at the top; the choice is kept on this device). The list view is described below. The **table view** shows only the table, over the whole screen, with each player's own buttons under their seat, so any player's action is one tap: **Dealer** before the hand starts (the expected dealer is lit), then, for everyone still to act this street, **Fold / Call N / Raise / All-In** when facing a bet or **Check / Bet / All-In** when not, plus **Straddle** for the first player preflop while it is on offer. Tapping a later player's button folds or checks the ones before them, as in the list view. Raise, Bet and All-In ask the amount in a sheet. Seats are blue for the player to act, lit for everyone else still in the hand, and faded for whoever folded or sits out. The list view uses the same seat colours (blue for the player being entered), and in both the dealer has a white D. Every player in the hand holds two cards, face down until you enter them (then face up); folding takes them away, or fades them if they were entered. What each player put in this street shows as a chip on the felt in front of them: white for a blind or call, red for a bet, raise or straddle, a red triangle for all-in, "Check" for a check. Beside the cards, at a glance: a ✕ that grows with each buy-in (full size at five) and five bars for the stack size. Tap a player (name or cards) for their sheet, with the card picker already open, then Sit Out, buy-in and stack (cards are kept when the sheet closes); the ✕ marks or bars open the same sheet. After the betting every player gets **Cards** too. End Street, End Hand and Save Hand stay at the bottom. Above them one **Log** line shows the last action entered; tap it for the whole log in a sheet, the same log as the list view's, where every row changes the same way (see **The log** below).

The table is the input. The **seat map** sits at the top, under the tabs, with the hand's log below it and the current question under the log: you at the bottom, the others clockwise, the dealer marked **D**, and the board in the middle: five card places, filled as the flop (3), turn (4) and river (5) are dealt, with the street and pot under them. Tap the board to pick its actual cards (optional): a 13×4 picker, cards in the order dealt (3 for the flop, then the turn, then the river), changeable any time; they show on the board, in the log and in the history ("Flop: J♥ 7♣ 2♦ · Checked").

1. **Sitting Out** is the first row of every hand: who sits this hand out ("Nobody", or their names), carried over from the hand before, so it costs no tap. They stay on the table faded and marked Out, and the hand is played without them. You can sit out too; the hand is still recorded ("You sit out" in the header). Change it from the **⋯** menu (this hand while nothing else is entered, otherwise from the next hand), or tap the row in the log to change this hand, saved hands included. At least two must play.
2. **Dealer?** The seat expected to hold the button (after the previous hand) is highlighted, and its name is a button on the question's line; tap that, or any seat.
3. The seat to act is lit and the controls say what they can do: **Fold**, **Check** or **Call N**, **Bet** or **Raise** (slider), and **Straddle** for the first player preflop. Each seat shows what it did this street (SB, BB, Str 10, Fold, Check, Call 25, Raise 75, Bet 40); folded seats fade out. **All-In** (beside Raise) takes the player's whole bet this street on the same slider as a raise, starting from 0 (their stack is not known). Above the bet it is a raise of any size and everyone acts again; at or below it, a call, for less if need be. An all-in player is never asked again, and once at most one player can still bet (and nobody owes), the board runs out to the river and the hand goes to the cards.
4. Tapping a later seat acts for them and resolves the seats in between in one go: they fold when facing a bet, check otherwise ("Roni, Gil fold · Tal raises to 25").
5. **End Street** does the same for everyone still to act: who can check checks, who faces a bet folds, and the next street is dealt (after the river, the hand goes to the cards). **End Hand**, beside it, stops the betting where it is. A hand ended that way shows **Continue Hand** beside Save Hand (both views, and on a saved hand being edited): the betting goes on where it stopped, cards entered are kept.
6. When one player is left, after the river, or after End Hand, the hand goes to **Cards Shown?**: tap any player and pick their cards (one or two) on the same 13×4 card picker as the board (in a sheet over the screen; cards already on the board or in another hand are greyed out), for as many players as showed. Tapping a player who already has cards opens them to change; Clear and OK takes them away. The cards show face up beside the player's seat, like the board, so the seat keeps its own text. Cards can also be entered mid-hand: **Cards** (beside End Street) asks **Whose Cards?**, tap the player. Each player's cards are one Shown row in the log, tap it to change them. Stats keep a two-card hand as its notation (A♥ K♦ → AKo); a single card is kept in the hand for later.
7. **Save Hand** (under Cards Shown?) moves the button and deals the next hand. The header's Hand number says how many are done (Hand 5 = four saved).

**The log** (between the table and the controls in the list view; behind the Log line in the table view) always reads in the same order:

- **Sitting Out** and **Dealer** first.
- Then the betting, street by street: a heading per street (Preflop, Flop, Turn, River) with that street's board cards, then one row per player turn in the order they acted ("Roni · folds · auto", "Gil · raises to 25", "Shay · calls 25"). "auto" marks a turn the app filled in: a player skipped when you tapped a later one, or closed by End Street. **End Street** and **End Hand** show as rows of their own where you pressed them.
- Then the cards shown (one **Shown** row per player) and the **Note**.

Every row changes the same way, in one step, and never moves the rest of the log:

- **A player's turn** opens what they could do at that point (what they did is lit): Fold, Check or Call, Bet or Raise (amount), All-In, Straddle when it was on offer. A filled-in turn is changed the same way.
- **End Street** opens **Reopen Street**: it takes End Street back with the turns it filled in, so those players are to act again. **End Hand** opens **Continue Hand** (also a button beside Save Hand): the betting goes on where it stopped, with any cards already entered kept.
- **Sitting Out** and **Dealer** open the table in a sheet: tap to switch who sits out (Done), or tap the dealer.
- **A street heading** opens the board's cards; a **Shown** row that player's cards; the **Note** the note.

After a change, everything after it is checked again. What still fits stays: a filled-in turn follows the rule again (a fold facing a bet, a check otherwise), a call stays a call, and a player who now acts later gets the turns before them filled in. What no longer fits is taken out (a check now facing a bet, a raise now too small, a turn of a player who has folded, the next street's turns when the street is open again), and a note floats over the bottom of the screen for a few seconds saying how many, with **Undo**. The hand is always open at its end for more actions. This works the same on a saved hand reopened from the Session tab. **Undo** (↶, top right) steps back one change of any kind (an action, an edit, saving or skipping a hand, sitting a player out, opening or saving a past hand), up to 200 steps back; undoing a save takes the hand out of the saved list again.

**Note** (✎, top right) adds free text to the hand ("Tal limped AA"). It shows as the last log row (tap it to change it), is saved with the hand, and appears under the hand in History. To add one to a hand already saved, reopen it from the Session tab and Save Changes.

Saved hands keep their turns (one entry per player turn, the board and cards shown kept with the hand; hands saved before this are converted when read); the session and history lines are built from them. Each hand also keeps the time it was first entered (its first action after who sits out); editing it later never changes that time, and hands saved before times were kept have none. The actions are also mapped onto a question-based model of the hand (each raise with the callers before it, a street's first bet, the closing round of every street), which is kept with each saved hand for stats.

Raise slider: the steps are 1 big blind at the start, then 2, then 4 and so on, so the amount is always a multiple of the big blind. Defaults: open raise from settings (bigger over a straddle), 3-bet 3x the raise, 4-bet and above 2x; after the flop a bet is half the pot and a raise is 2x the bet.

Your own cards are the ones you enter for your seat under Cards Shown? (optional); they show with the other cards shown. The **⋯** menu (Players) sits a player (or you) out or back in, and shows each player's **buy-in** (all chips bought in for so far, rebuys included) and **stack** size; tap a player for two sliders: Buy-In from the game's buy-in (Settings, 300 by default) up to 2000 in steps of 100, and Stack (0–100, 100–250, 250–500, 500–1000, 1000+; 250–500 until set). Both carry over from hand to hand until changed, apply to the hand in progress as soon as they change, and every saved hand keeps them as they were at that hand, for insights later. Reopening a saved hand (from the Session tab) loads its actions, to change row by row; Save or Cancel returns to the hand in progress.

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
