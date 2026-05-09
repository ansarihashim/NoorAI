import { forwardRef, useId, useState } from 'react'

const Input = forwardRef(function Input(
  {
    label,
    type = 'text',
    error,
    hint,
    leftIcon,
    rightIcon,
    mono = false,
    className = '',
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const id = useId()
  const [focused, setFocused] = useState(false)

  return (
    <label htmlFor={id} className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
          {label}
        </span>
      )}
      <span
        className={[
          'group relative flex items-center gap-2 rounded-xl border bg-white/[0.03] backdrop-blur-sm',
          'transition-colors duration-200 ease-expo',
          error
            ? 'border-accent-rose/60'
            : focused
              ? 'border-accent-purple/60'
              : 'border-white/[0.08] hover:border-white/[0.14]',
          'focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]',
          className,
        ].join(' ')}
      >
        {leftIcon && <span className="pl-3.5 text-ink-muted">{leftIcon}</span>}
        <input
          ref={ref}
          id={id}
          type={type}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          className={[
            'peer w-full bg-transparent px-3.5 py-3 text-[0.9375rem] text-ink placeholder:text-ink-faint',
            'outline-none',
            mono ? 'font-mono text-sm' : '',
          ].join(' ')}
          {...rest}
        />
        {rightIcon && <span className="pr-3.5 text-ink-muted">{rightIcon}</span>}
      </span>
      {(error || hint) && (
        <span
          className={[
            'mt-1.5 block text-xs',
            error ? 'text-accent-rose' : 'text-ink-muted',
          ].join(' ')}
        >
          {error || hint}
        </span>
      )}
    </label>
  )
})

export default Input
