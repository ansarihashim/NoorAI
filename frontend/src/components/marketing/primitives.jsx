import { Children, isValidElement } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* Reusable motion wrappers for the marketing surface.
   Centralized so every section reveal feels identical and calm. */

export const ease = [0.22, 1, 0.36, 1]

export function FadeUp({ children, delay = 0, y = 18, duration = 0.7, className = '', once = true, viewportMargin = '-80px' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once, margin: viewportMargin }}
      transition={{ duration, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerGroup — reveal each direct child as it enters the viewport, with
 * a small delay between consecutive children so a row of cards "cascades
 * in" instead of all popping at once.
 *
 *   <StaggerGroup className="grid gap-4 md:grid-cols-3">
 *     <Card .../>
 *     <Card .../>
 *     <Card .../>
 *   </StaggerGroup>
 *
 * Internally each child is wrapped in a FadeUp with a computed delay
 * (`i * stagger`). Container element stays a normal div so existing
 * grid / flex classes apply unchanged.
 */
export function StaggerGroup({
  children,
  stagger = 0.08,
  initialDelay = 0,
  y = 20,
  duration = 0.65,
  className = '',
  as: As = 'div',
}) {
  const items = Children.toArray(children).filter(Boolean)
  return (
    <As className={className}>
      {items.map((child, i) => (
        <FadeUp
          key={isValidElement(child) && child.key != null ? child.key : i}
          y={y}
          duration={duration}
          delay={initialDelay + i * stagger}
        >
          {child}
        </FadeUp>
      ))}
    </As>
  )
}

export function Eyebrow({ children, accent = false, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border border-echo-border px-3 py-1',
        'text-[0.68rem] font-medium uppercase tracking-[0.18em]',
        accent ? 'text-echo-accent-soft' : 'text-echo-muted',
        'bg-echo-text/[0.02] backdrop-blur-sm',
        className,
      ].join(' ')}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-echo-accent" />
      {children}
    </span>
  )
}

export function SectionHeader({ eyebrow, title, subtitle, align = 'center', className = '' }) {
  const isCenter = align === 'center'
  return (
    <div
      className={[
        'flex w-full flex-col gap-5',
        isCenter ? 'items-center text-center' : 'items-start text-left',
        className,
      ].join(' ')}
    >
      {eyebrow && <Eyebrow accent>{eyebrow}</Eyebrow>}
      <FadeUp>
        <h2
          className={[
            'font-serif tracking-tight text-balance',
            'text-[clamp(1.85rem,3.6vw,3rem)] leading-[1.05] font-medium',
            'text-echo-text',
          ].join(' ')}
        >
          {title}
        </h2>
      </FadeUp>
      {subtitle && (
        <FadeUp delay={0.08}>
          <p
            className={[
              'max-w-2xl text-pretty text-[1.02rem] leading-relaxed text-echo-muted',
              isCenter ? 'mx-auto' : '',
            ].join(' ')}
          >
            {subtitle}
          </p>
        </FadeUp>
      )}
    </div>
  )
}

export function GlowDot({ size = 'sm', className = '' }) {
  const sz = size === 'lg' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5'
  return (
    <span
      className={[
        'relative inline-flex items-center justify-center',
        className,
      ].join(' ')}
    >
      <span className={[sz, 'rounded-full bg-echo-accent'].join(' ')} />
      <span className={[sz, 'absolute inline-flex animate-ping rounded-full bg-echo-accent opacity-50'].join(' ')} />
    </span>
  )
}
