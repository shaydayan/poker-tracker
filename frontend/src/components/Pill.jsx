// Small fixed-width tag (position label, status).
const TONES = { neutral: 'bg-line text-muted', accent: 'bg-accent/20 text-accent' }

export function Pill({ tone = 'neutral', className = '', children }) {
  return <span className={`inline-flex h-6 w-14 items-center justify-center rounded-md text-xs font-semibold ${TONES[tone]} ${className}`}>{children}</span>
}
