import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query and re-render when it flips.
 *
 *   const isMobile = useMediaQuery('(max-width: 767px)')
 *
 * Notes:
 *  - SSR-safe: the initial value falls back to `false` when window is undefined.
 *  - Uses the modern `addEventListener('change', …)` MQL API; we avoid the
 *    deprecated `addListener` shim so React 18 strict-mode unmount cleanups
 *    are deterministic.
 *  - One MediaQueryList per call site; this is fine — they're cheap and the
 *    browser dedupes the underlying listener.
 */
export default function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false

  const [matches, setMatches] = useState(get)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    setMatches(mql.matches) // sync any drift after mount
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

// Common breakpoints used across the app — hardcoded so each call site
// gets the SAME MQL string (browsers dedupe the underlying listener).
export const BP = {
  mobile:    '(max-width: 767px)',
  tablet:    '(min-width: 768px) and (max-width: 1023px)',
  desktop:   '(min-width: 1024px)',
  notMobile: '(min-width: 768px)',
}
