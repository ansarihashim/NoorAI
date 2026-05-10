/**
 * NoorAI mark — abstract mashaal in solid vivid yellow on black.
 * Solid color, no gradient (gradients render dull on dark surfaces).
 * The `animated` prop is kept for API compatibility but is now a no-op.
 */
export default function NoorMark({
  size = 32,
  withChrome = true,
  className = '',
}) {
  const yellow = '#FFD60A'

  return (
    <span
      className={['relative inline-flex shrink-0 items-center justify-center', className].join(' ')}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size} height={size} className="relative">
        {withChrome && (
          <rect
            width="32"
            height="32"
            rx="8"
            fill="#000000"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="0.8"
          />
        )}

        {/* outer flame curves — solid vivid yellow */}
        <path
          d="M16 28 C 7.5 24 6 16 11 9 C 12.6 6.6 14.4 4.6 16 3.5"
          stroke={yellow}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M16 28 C 24.5 24 26 16 21 9 C 19.4 6.6 17.6 4.6 16 3.5"
          stroke={yellow}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* inner waveform tongues */}
        <path
          d="M13.5 24 C 11 20.5 11.5 15 14.2 11.5"
          stroke={yellow}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M18.5 24 C 21 20.5 20.5 15 17.8 11.5"
          stroke={yellow}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* glowing core — solid vivid yellow */}
        <circle cx="16" cy="19" r="2.8" fill={yellow} />
      </svg>
    </span>
  )
}
