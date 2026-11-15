// Player names. A name identifies a player in hands and stats, so no two players may share one
// (compared trimmed and case-insensitive: "dani " and "Dani" are the same name). Pure.

const key = (name) => name.trim().toLowerCase()

/** True when `name` matches one of `names`. */
export function nameTaken(name, names) {
  return names.some((n) => key(n) === key(name))
}

/** Why `name` cannot be used next to `names`, or null when it can. */
export function validatePlayerName(name, names) {
  if (!name.trim()) return 'Enter a name.'
  if (nameTaken(name, names)) return `${name.trim()} is already taken.`
  return null
}

/** The first "Guest N" not already in `names`. */
export function guestName(names) {
  let n = 1
  while (nameTaken(`Guest ${n}`, names)) n++
  return `Guest ${n}`
}
