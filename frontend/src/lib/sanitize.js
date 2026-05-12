import DOMPurify from 'dompurify'

/**
 * Frontend XSS-defence helpers.
 *
 * The codebase has exactly one `dangerouslySetInnerHTML` site (the Mermaid
 * SVG renderer). Mermaid is initialised with `securityLevel: 'strict'` —
 * but that's a single line of defence and the SVG it produces still embeds
 * arbitrary text from the LLM. We funnel every HTML/SVG injection through
 * DOMPurify here so a Mermaid bypass (or a future place that does the same
 * thing) cannot land script execution.
 *
 * We also export a few text helpers so route handlers / cards that show
 * LLM-generated strings can normalise zero-width characters, strip control
 * chars, and clamp length without sprinkling regexes through every JSX
 * leaf.
 */

const SVG_PROFILE = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Allow <style> (Mermaid emits an inline stylesheet that sets text
  // colours; stripping it leaves every label invisible) and <title> for
  // tooltip text. Both are inert — no scripting surface.
  ADD_TAGS: ['style', 'title'],
  // Block scriptable handlers + javascript: / data: text rendered as html.
  FORBID_TAGS: ['script', 'foreignObject'],
  FORBID_ATTR: [
    'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseenter',
    'onmouseleave', 'onfocus', 'onblur', 'onkeydown', 'onsubmit',
  ],
  ALLOW_DATA_ATTR: false,
}

/**
 * Sanitize an SVG string before it reaches `dangerouslySetInnerHTML`.
 * Returns the cleaned markup. If DOMPurify isn't available (e.g. SSR),
 * returns an empty string rather than risking a raw injection.
 */
export function sanitizeSvg(input) {
  if (typeof input !== 'string' || input.length === 0) return ''
  try {
    return DOMPurify.sanitize(input, SVG_PROFILE)
  } catch {
    return ''
  }
}

/**
 * Sanitize an arbitrary HTML string before injection. Used for content we
 * never expect to contain interactive elements.
 */
export function sanitizeHtml(input) {
  if (typeof input !== 'string' || input.length === 0) return ''
  try {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [
        'a', 'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span', 'code',
        'pre', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4',
        'h5', 'h6',
      ],
      ALLOWED_ATTR: ['href', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
    })
  } catch {
    return ''
  }
}

/**
 * Coerce any value to a safe display string. Strips control characters
 * (CR/LF/tab are kept), normalises Unicode, and clamps to a maximum
 * length. JSX already escapes `{value}` — this is defence-in-depth for
 * spots where a value is concatenated into another string before render.
 */
export function safeText(value, { max = 4000 } = {}) {
  if (value == null) return ''
  const s = typeof value === 'string' ? value : String(value)
  // Drop NULs, BOMs, and the rest of the C0/C1 control range except \n\r\t.
  // eslint-disable-next-line no-control-regex
  const stripped = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F​-‏‪-‮﻿]/g, '')
  const normalised = stripped.normalize('NFC')
  return normalised.length > max ? normalised.slice(0, max) + '…' : normalised
}

/**
 * Simple `href` allowlist — used by any place that wants to render a link
 * pointing at user/AI-generated content. Returns `null` for anything that
 * isn't `https://`, `http://`, or `mailto:`.
 */
export function safeHref(href) {
  if (typeof href !== 'string') return null
  const trimmed = href.trim()
  if (!trimmed) return null
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return null
  }
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return null
}
