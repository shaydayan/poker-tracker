// Exact cards, one row per suit and one column per rank (A to 2). Tap to add a card, tap it again to remove it.
// `value` is the cards picked, in order ("Ah"); `max` caps how many; `taken` are cards already used elsewhere (greyed out);
// `onChange` gets the new list.
import { RANKS, SUITS, cardLabel, isRed } from '../domain/cards.js'

export function CardPicker({ value, max, taken = [], onChange }) {
  const full = value.length >= max
  const toggle = (card) => onChange(value.includes(card) ? value.filter((c) => c !== card) : [...value, card])
  return (
    <div className="grid grid-cols-13 gap-px">
      {SUITS.map((suit) =>
        RANKS.map((rank) => {
          const card = rank + suit
          const picked = value.includes(card)
          return (
            <button
              key={card}
              type="button"
              aria-label={cardLabel(card)}
              disabled={!picked && (full || taken.includes(card))}
              className={`flex aspect-[3/4] flex-col items-center justify-center rounded-sm bg-panel text-[11px] leading-none font-semibold active:opacity-70 disabled:opacity-30 ${isRed(card) ? 'text-raise' : 'text-ink'} ${picked ? 'ring-2 ring-accent' : ''}`}
              onClick={() => toggle(card)}
            >
              <span>{rank}</span>
              <span className="text-[9px]">{cardLabel(card)[1]}</span>
            </button>
          )
        }),
      )}
    </div>
  )
}
