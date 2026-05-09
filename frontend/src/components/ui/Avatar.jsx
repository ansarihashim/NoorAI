function hashColor(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  // pick from a curated palette so it always looks on-brand
  const palette = [
    'from-accent-purple to-accent-cyan',
    'from-accent-cyan to-accent-green',
    'from-accent-purple to-accent-rose',
    'from-accent-green to-accent-cyan',
    'from-accent-amber to-accent-rose',
  ]
  return palette[h % palette.length]
}

export default function Avatar({ name = '?', email = '', size = 36, className = '' }) {
  const initial = (name || email || '?').trim().charAt(0).toUpperCase() || '?'
  const grad = hashColor(email || name || '?')
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full text-white font-semibold',
        'bg-gradient-to-br shadow-hairline',
        grad,
        className,
      ].join(' ')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-label={name || email}
    >
      {initial}
    </span>
  )
}
