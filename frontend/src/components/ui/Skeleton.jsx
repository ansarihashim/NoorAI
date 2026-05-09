export default function Skeleton({ className = '', children }) {
  return (
    <div
      className={[
        'shimmer rounded-lg',
        className || 'h-4 w-full',
      ].join(' ')}
      aria-busy
      aria-live="polite"
    >
      {children}
    </div>
  )
}
