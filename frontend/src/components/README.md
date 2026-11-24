# Component inventory

Shared UI controls. Reuse these; do not hand-style a control that exists here.

- **Button** — every clickable control. `variant`: primary | secondary | ghost | fold | raise | danger; `size`: md | sm | xs (the small action buttons under a seat in the table view); variant `surface` is a lit tile (a player still in the hand); `active` for toggle state. Give it a fixed width class (`w-14`, `w-16`…) when its label can change.
- **Pill** — fixed-width tag for position labels and short statuses. `tone`: neutral | accent.
- **Field** — labelled text/number input for forms (blinds, names).
- **Sheet** — bottom overlay for any secondary choice (menu, players). Never reflows the page.
- **Toast** — a short message floating over the bottom of the screen for a few seconds, with one optional action button (e.g. Undo); `notice` is { text, key }. Never reflows the page.
- **TopBar** — fixed-height screen header with title, subtitle slot and right-side controls.
- **Slider** — slider over a list of allowed `values` with a big readout; use for any numeric pick (raise size ladder).
- **CardPicker** — exact cards (13 ranks × 4 suits); use when specific cards are picked (the board, a player's shown cards). `value` (ordered list), `max`, `taken` (greyed out), `onChange`.
- **SeatMap** — the players around the table, me at the bottom; use whenever a player is picked. two lines per seat (name, `status`); `enabled` limits who can be tapped, `readOnly` shows it as context, `active` highlights one, `tones` recolours seats, `badges` adds a white marker (dealer "D"), `hands` a player's shown cards beside their seat (as cards, like the board), `board` ({ count, cards, caption, sub, onPick }) shows the community cards in the middle, tappable with `onPick`. `fill` spreads the table over all the space given (seats in two side columns, shrunk only when a short screen needs it) with `below[seat]` under each seat (that player's controls) and `bets[seat]` ({ text, tone: call | raise | allin | check }) as a chip on the felt in front of the seat (round chip; a red triangle for all-in). Also exports **Card** (one playing card, as on the board; face down when `dealt` without a card; `small` under a seat).
- **Row** — tappable list row (label, value, trailing mark) for the hand history and hand lists; `muted` fades a context-only row; `wrap` lets a long text wrap (detail lines); `onLongPress` for a held press (e.g. delete), right-click on a computer. Fixed height otherwise; never put a Button inside it.
- **TabBar** — tab bar along the top for switching top-level screens. `tabs`: [{ id, label, disabled }].
