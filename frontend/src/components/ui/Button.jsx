import { forwardRef } from 'react'
import { motion } from 'framer-motion'

/**
 * Refined Button — Airbnb-grade restraint.
 *  - Subtle borders, single subtle shadow at most.
 *  - Hover transitions a property up (background, border, text), never adds
 *    a giant halo. Active state nudges scale to 0.98.
 *  - Primary uses solid amber background with a hairline ring instead of
 *    a glow shadow.
 */

const VARIANTS = {
  primary:
    'bg-accent text-page border border-accent hover:bg-accent-bright hover:border-accent-bright active:scale-[0.985]',
  secondary:
    'bg-elevated text-ink border border-rule hover:border-rule-strong hover:bg-float',
  outline:
    'bg-transparent text-ink border border-rule hover:border-accent hover:bg-elevated',
  ghost:
    'bg-transparent text-ink-muted border border-transparent hover:text-ink hover:bg-elevated',
  destructive:
    'bg-accent-deep text-page border border-accent-deep hover:bg-accent active:scale-[0.985]',
}

const SIZES = {
  sm: 'h-8 px-3 text-[0.81rem] rounded-md',
  md: 'h-9 px-4 text-[0.86rem] rounded-md',
  lg: 'h-11 px-5 text-[0.92rem] rounded-md',
  xl: 'h-12 px-6 text-[0.95rem] rounded-md',
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
        whileTap: disabled || loading ? undefined : { scale: 0.985 },
        transition: { type: 'spring', stiffness: 600, damping: 36 },
      }
    : {}

  return (
    <As
      ref={ref}
      type={isMotion ? type : undefined}
      disabled={disabled || loading}
      className={[
        'group relative inline-flex select-none items-center justify-center gap-2 font-medium',
        'transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
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
