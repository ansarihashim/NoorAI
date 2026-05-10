import Waveform from './Waveform.jsx'

/**
 * Hero centerpiece — a clean, static open-book illustration.
 * Pure black surface, solid yellow accents. No animation, no glow,
 * no foggy lighting. Sized to sit in the right column of the hero.
 */
export default function BookVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="relative aspect-[5/4]">
        <BookSvg />
      </div>

      {/* Static caption card — sits below the book, no float, no animation */}
      <div className="mx-auto mt-6 w-full max-w-[420px] rounded-xl border border-echo-border bg-echo-surface p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-echo-border bg-echo-bg text-echo-accent">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 11v2M7 8v8M11 4v16M15 8v8M19 11v2" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-echo-muted">
              Narrating
            </div>
            <div className="truncate text-[0.9rem] font-medium text-echo-text">
              Cellular Respiration · pg 4
            </div>
          </div>
          <span className="font-mono text-[0.74rem] text-echo-muted">02:41</span>
        </div>
        <div className="mt-3">
          <Waveform bars={42} height={28} width={2} gap={3} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* Static SVG — no animation, no gradient overlays. Solid colors. */
/* ------------------------------------------------------------- */
function BookSvg() {
  return (
    <svg
      viewBox="0 0 460 360"
      className="block h-full w-full"
      aria-hidden
    >
      {/* Book covers (left + right slightly tilted) */}
      <path d="M 30 70 L 226 88 L 226 280 L 30 264 Z" fill="#0A0A0A" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <path d="M 234 88 L 430 70 L 430 264 L 234 280 Z" fill="#0A0A0A" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* Pages — left + right (off-white) */}
      <path d="M 40 80 L 226 94 L 226 268 L 40 256 Z" fill="#F4ECDC" />
      <path d="M 234 94 L 420 80 L 420 256 L 234 268 Z" fill="#F4ECDC" />

      {/* Spine */}
      <rect x="226" y="88" width="8" height="192" fill="#000000" />

      {/* === Left page content =================================== */}
      <text x="55" y="110" fontFamily="'Source Serif 4', Georgia, serif" fontSize="14" fontWeight="700" fill="#0A0A0A">
        Cellular Respiration
      </text>
      {[130, 144, 158, 172, 186, 200, 214, 228, 242].map((y, i) => (
        <rect
          key={`l-${i}`}
          x="55"
          y={y}
          width={i % 3 === 2 ? 110 : 152}
          height="2.4"
          fill="rgba(10,10,10,0.55)"
          rx="1"
        />
      ))}
      {/* yellow highlight stripe */}
      <rect x="55" y="152" width="152" height="9" rx="2" fill="#FFD60A" opacity="0.85" />
      {/* yellow underline */}
      <rect x="55" y="193" width="110" height="2" rx="1" fill="#FFD60A" />

      {/* === Right page content =================================== */}
      <text x="252" y="110" fontFamily="'Source Serif 4', Georgia, serif" fontSize="11" fontWeight="700" fill="#0A0A0A">
        Stages of ATP Synthesis
      </text>
      {[
        { y: 132, label: 'Glycolysis' },
        { y: 154, label: 'Krebs Cycle' },
        { y: 176, label: 'Electron Transport' },
        { y: 198, label: 'ATP Synthase' },
      ].map((s, i) => (
        <g key={s.label}>
          <circle cx="262" cy={s.y} r="2.6" fill={i === 1 ? '#FFD60A' : 'rgba(10,10,10,0.55)'} />
          <text
            x="272"
            y={s.y + 3.5}
            fontFamily="'Source Serif 4', Georgia, serif"
            fontSize="9.5"
            fontWeight={i === 1 ? '700' : '400'}
            fill="#0A0A0A"
          >
            {s.label}
          </text>
          {i < 3 && (
            <line x1="262" y1={s.y + 3} x2="262" y2={s.y + 19} stroke="rgba(10,10,10,0.35)" strokeWidth="0.6" strokeDasharray="2,2" />
          )}
        </g>
      ))}

      {/* mini diagram */}
      <g transform="translate(330 120)">
        <rect width="68" height="100" rx="4" fill="#FFF6E0" stroke="rgba(245,185,66,0.45)" strokeWidth="1" />
        <text x="6" y="14" fontSize="7.5" fontWeight="700" fill="#0A0A0A" fontFamily="'Source Serif 4', Georgia, serif">
          FIG · 4.1
        </text>
        {[20, 50, 35, 70, 28, 60].map((h, i) => (
          <rect
            key={i}
            x={6 + i * 10}
            y={90 - h}
            width="6"
            height={h}
            fill="#FFD60A"
            opacity={0.5 + (i % 3) * 0.15}
          />
        ))}
      </g>

      {/* page numbers */}
      <text x="100" y="260" fontSize="8" fill="rgba(10,10,10,0.55)" fontFamily="'Source Serif 4', Georgia, serif">— 12 —</text>
      <text x="346" y="260" fontSize="8" fill="rgba(10,10,10,0.55)" fontFamily="'Source Serif 4', Georgia, serif">— 13 —</text>

      {/* Sticky note (top-left) */}
      <g transform="translate(0 24) rotate(-4 100 60)">
        <rect x="14" y="28" width="160" height="74" rx="4" fill="#FFE100" />
        <rect x="14" y="28" width="160" height="14" fill="#FFD60A" />
        <text x="22" y="38" fontSize="6.5" fontWeight="700" fill="#0A0A0A" fontFamily="'Inter Tight', sans-serif">
          NOTE
        </text>
        <text x="22" y="62" fontSize="9" fontWeight="500" fill="#0A0A0A" fontFamily="'Source Serif 4', Georgia, serif">
          ATP = the cell&apos;s
        </text>
        <text x="22" y="76" fontSize="9" fontWeight="500" fill="#0A0A0A" fontFamily="'Source Serif 4', Georgia, serif">
          rechargeable battery.
        </text>
      </g>

      {/* Concept tag (top-right) */}
      <g transform="translate(360 18)">
        <rect width="86" height="22" rx="11" fill="#0A0A0A" stroke="#FFD60A" strokeWidth="1" />
        <circle cx="12" cy="11" r="2.5" fill="#FFD60A" />
        <text x="20" y="14.5" fontSize="8" fontWeight="600" fill="#FFFFFF" fontFamily="'Inter Tight', sans-serif">
          Krebs Cycle
        </text>
      </g>

      {/* Pencil (right side) */}
      <g transform="translate(360 246) rotate(24 60 15)">
        <rect x="0" y="6" width="14" height="18" rx="2" fill="#FFDD00" />
        <rect x="14" y="6" width="4" height="18" fill="#0A0A0A" />
        <rect x="18" y="6" width="78" height="18" fill="#FFD60A" stroke="rgba(10,10,10,0.35)" strokeWidth="0.6" />
        <polygon points="96,6 116,15 96,24" fill="#FFE9B0" stroke="rgba(10,10,10,0.35)" strokeWidth="0.6" />
        <polygon points="110,12 116,15 110,18" fill="#0A0A0A" />
      </g>
    </svg>
  )
}
