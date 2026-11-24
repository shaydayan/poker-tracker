// One button for the whole app. Variants define colours once; size only changes height/text (xs: the small action
// buttons under a seat in the table view).
const VARIANTS = {
  primary: 'bg-accent text-white',
  secondary: 'bg-panel border border-line text-ink',
  ghost: 'text-muted',
  fold: 'bg-fold text-ink',
  raise: 'bg-raise text-white',
  danger: 'bg-panel border border-raise text-raise',
  surface: 'bg-fold border border-line text-ink', // a lit tile: a player still in the hand
}
const SIZES = { md: 'h-11 text-sm', sm: 'h-9 text-xs', xs: 'h-7 text-[11px]' }

export function Button({ variant = 'secondary', size = 'md', active = false, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`shrink-0 rounded-lg px-2 font-medium whitespace-nowrap active:opacity-70 disabled:opacity-30 ${VARIANTS[variant]} ${SIZES[size]} ${active ? 'ring-2 ring-accent' : ''} ${className}`}
      {...props}
    />
  )
}
