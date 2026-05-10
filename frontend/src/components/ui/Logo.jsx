import NoorMark from './NoorMark.jsx'

export function LogoMark({ size = 24, animated = false, withChrome = true, className = '' }) {
  return <NoorMark size={size} animated={animated} withChrome={withChrome} className={className} />
}

export default function Logo({ size = 24, withWordmark = true, animated = false, className = '' }) {
  return (
    <span className={['inline-flex items-center gap-2.5', className].join(' ')}>
      <NoorMark size={size} animated={animated} />
      {withWordmark && (
        <span className="font-serif text-[0.95rem] font-medium tracking-tight text-ink">
          NoorAI
        </span>
      )}
    </span>
  )
}
