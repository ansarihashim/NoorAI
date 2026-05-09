import { forwardRef } from 'react'
import { motion } from 'framer-motion'

const VARIANTS = {
  primary:
    'text-white bg-gradient-to-b from-accent-purple to-[#7c4ce9] hover:to-[#7541e3] shadow-glow border border-white/10',
  secondary:
    'text-ink bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08]',
  ghost:
    'text-ink-muted hover:text-ink hover:bg-white/[0.05] border border-transparent',
  outline:
    'text-ink bg-transparent border border-white/[0.12] hover:border-white/[0.22] hover:bg-white/[0.04]',
  destructive:
    'text-white bg-gradient-to-b from-accent-rose to-[#e0506a] hover:brightness-110 border border-white/10',
}

const SIZES = {
  sm: 'h-8 px-3 text-[0.8125rem] rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
  xl: 'h-14 px-8 text-base rounded-2xl',
}

const Button = forwardRef(function Button(
  {
    as: As = motion.button,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isMotion = As === motion.button
  const motionProps = isMotion
    ? {
        whileTap: disabled || loading ? undefined : { scale: 0.97 },
        transition: { type: 'spring', stiffness: 500, damping: 30 },
      }
    : {}

  return (
    <As
      ref={ref}
      type={isMotion ? type : undefined}
      disabled={disabled || loading}
      className={[
        'group relative inline-flex select-none items-center justify-center gap-2 font-medium tracking-tight',
        'transition-colors duration-250 ease-expo',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...motionProps}
      {...rest}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin"
          aria-hidden
        />
      )}
      {!loading && leftIcon && <span className="-ml-0.5 inline-flex">{leftIcon}</span>}
      <span className="relative">{children}</span>
      {!loading && rightIcon && <span className="-mr-0.5 inline-flex">{rightIcon}</span>}
    </As>
  )
})

export default Button
