export function LogoMark({ size = 28, className = '' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ev-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#10142a" />
      <g stroke="url(#ev-grad)" strokeWidth="2.4" strokeLinecap="round">
        <line x1="9" y1="20" x2="9" y2="12" />
        <line x1="13" y1="22" x2="13" y2="10" />
        <line x1="17" y1="20" x2="17" y2="12" />
        <line x1="21" y1="23" x2="21" y2="9" />
        <line x1="25" y1="21" x2="25" y2="11" />
      </g>
    </svg>
  )
}

export default function Logo({ size = 28, withWordmark = true, className = '' }) {
  return (
    <span className={['inline-flex items-center gap-2', className].join(' ')}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="text-[0.95rem] font-semibold tracking-tight">
          <span className="text-accent-purple-soft">Echo</span>
          <span className="text-accent-cyan-soft">Verse</span>
        </span>
      )}
    </span>
  )
}
