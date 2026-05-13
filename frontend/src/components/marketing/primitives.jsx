import { Children, isValidElement } from 'react'
import { motion } from 'framer-motion'

/* Reusable motion wrappers for the marketing surface.
   Centralized so every section reveal feels identical and calm. */

export const ease = [0.22, 1, 0.36, 1]

/**
 * FadeUp — slide-up + fade-in reveal triggered when the element enters
 * the viewport.
 *
 * Important: we DON'T short-circuit on `prefers-reduced-motion` here.
 * The marketing reveals are small (y=24, 0.7s) and core to how the page
 * communicates "AI workspace". Killing them entirely makes the page feel
 * broken to users on Windows/macOS who turn reduce-motion on for the OS
 * but expect web pages to still feel alive. The motion stays subtle.
 *
 * Trigger geometry:
 *   - `amount: 0.15` — fire when ~15% of the element is visible (default
 *     is "some" which is `1px` and can feel jumpy).
 *   - `margin: viewportMargin` — defaults to `0px 0px -10% 0px`, meaning
 *     the bottom edge of the trigger zone is pulled UP by 10% of the
 *     viewport — animations fire ahead of the element fully arriving.
 *   - `once: true` — animate the first time only; re-scrolling does not
 *     re-fire (avoids the "animation loops while doom-scrolling" look).
 */
export function FadeUp({
  children,
  delay = 0,
  y = 44,
  duration = 0.85,
  scaleFrom = 0.96,
  className = '',
  once = true,
  amount = 0.15,
  viewportMargin = '0px 0px -8% 0px',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y, scale: scaleFrom }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once, amount, margin: viewportMargin }}
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
  stagger = 0.1,
  initialDelay = 0,
  y = 36,
  duration = 0.75,
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
