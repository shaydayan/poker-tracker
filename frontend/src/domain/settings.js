// App-wide settings: who I am, blinds, straddle, default raise sizes. Pure.
export const DEFAULT_SETTINGS = {
  heroPlayerId: null,
  smallBlind: 5,
  bigBlind: 5,
  straddle: 10,
  openRaise: 25, // default open raise, in chips
  straddleOpenRaise: 45, // default open raise over a straddle, in chips
  threeBet: 3, // 3-bet default = this x the raise
  fourBet: 2, // 4-bet and above = this x the previous raise
  postflopRaise: 2, // a raise after the flop = this x the bet
  buyIn: 300, // the game's (smallest) buy-in, in chips: everyone's total buy-in starts here
}

export function validateSettings(s) {
  if (!s.heroPlayerId) return 'Enter your name.'
  if (!(s.smallBlind > 0) || !(s.bigBlind > 0)) return 'Blinds must be positive.'
  if (!(s.straddle > 0)) return 'Straddle must be positive.'
  if (!(s.openRaise > 0) || !(s.straddleOpenRaise > 0)) return 'Open raises must be positive.'
  if (!(s.buyIn > 0)) return 'Buy-in must be positive.'
  if (!(s.threeBet > 1) || !(s.fourBet > 1) || !(s.postflopRaise > 1)) return 'Raise multipliers must be above 1.'
  return null
}
