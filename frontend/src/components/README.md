# Component inventory

Shared UI controls. Reuse these; do not hand-style a control that exists here.

- **Button** — every clickable control. `variant`: primary | secondary | ghost | fold | raise | danger; `size`: md | sm; `active` for toggle state. Give it a fixed width class (`w-14`, `w-16`…) when its label can change.
- **Pill** — fixed-width tag for position labels and short statuses. `tone`: neutral | accent.
- **Field** — labelled text/number input for forms (blinds, names).
- **Sheet** — bottom overlay for any secondary choice (menu, players). Never reflows the page.
- **TopBar** — fixed-height screen header with title, subtitle slot and right-side controls.
- **Slider** — slider over a list of allowed `values` with a big readout; use for any numeric pick (raise size ladder).
- **CardPicker** — exact cards (13 ranks × 4 suits); use when specific cards are picked (the board, a player's shown cards). `value` (ordered list), `max`, `taken` (greyed out), `onChange`.
- **SeatMap** — the players around the table, me at the bottom; use whenever a player is picked. two lines per seat (name, `status`); `enabled` limits who can be tapped, `readOnly` shows it as context, `active` highlights one, `tones` recolours seats, `badges` adds a marker (dealer "D"), `hands` a player's shown cards beside their seat (as cards, like the board), `board` ({ count, cards, caption, onPick }) shows the community cards in the middle, tappable with `onPick`.
- **Row** — tappable list row (label, value, trailing mark) for the hand history and hand lists; `muted` fades a context-only row; `wrap` lets a long text wrap (detail lines). Fixed height otherwise; never put a Button inside it.
- **TabBar** — bottom tab bar for switching top-level screens. `tabs`: [{ id, label, disabled }].
