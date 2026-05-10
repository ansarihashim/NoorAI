import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateExplanation } from '../../lib/api.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'

const SAMPLE_TOPICS = [
  'Glycolysis',
  'The citric acid cycle',
  'Why fermentation produces less ATP',
  'Oxidative phosphorylation',
]

export default function ExplanationView({ docIds, action }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [exp, setExp] = useState(null)
  const [history, setHistory] = useState([])

  // Right-rail "Simplify a topic" / "Generate an analogy" — focus the
  // input so the user can immediately type what they want explained.
  useEffect(() => {
    if (!action) return
    if (action.action !== 'simplify-topic' && action.action !== 'analogy') return
    inputRef.current?.focus()
  }, [action])

  const onGenerate = useCallback(async () => {
    const t = topic.trim()
    if (!t) {
      toast.error('Tell me what to explain', 'Try "the citric acid cycle"')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const e = await generateExplanation(docIds, t)
      setExp(e)
      setHistory((cur) => {
        const next = [{ topic: t, ts: Date.now() }, ...cur.filter((h) => h.topic !== t)]
        return next.slice(0, 8)
      })
      toast.success('Explanation ready', t)
    } catch (err) {
      toast.error('Generation failed', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }, [topic, docIds, busy, toast])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-caption text-ink-muted">simplest explanation</span>
        <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
          Explain a topic like I'm new to it.
        </h2>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          Pick (or type) a topic — NoorAI will explain it in beginner-friendly language with analogies and examples drawn only from your notes.
        </p>
      </div>

      {/* Composer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type a topic (e.g. Glycolysis)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onGenerate()
            }
          }}
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent-purple/50"
        />
        <Button onClick={onGenerate} loading={busy} size="md">Explain</Button>
      </div>

      {!exp && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[0.7rem] text-ink-faint">try:</span>
          {SAMPLE_TOPICS.map((s) => (
            <button
              key={s}
              onClick={() => setTopic(s)}
              className="rounded-pill border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[0.7rem] text-ink-muted hover:border-white/[0.14] hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Explanation card */}
      <AnimatePresence mode="wait">
        {exp && (
          <motion.div
            key={exp.topic}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-strong space-y-5 p-6 sm:p-7"
          >
            <div>
              <span className="font-caption text-ink-muted">explaining</span>
              <h3 className="mt-1 text-[1.05rem] font-semibold text-ink">{exp.topic}</h3>
            </div>

            <p className="text-pretty text-[0.95rem] leading-relaxed text-ink">
              {exp.explanation}
            </p>

            {exp.analogies && exp.analogies.length > 0 && (
              <div>
                <div className="font-caption text-accent-purple-soft">analogies</div>
                <ul className="mt-2 space-y-1.5">
                  {exp.analogies.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-[0.875rem] text-ink-muted">
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-accent-purple" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {exp.examples && exp.examples.length > 0 && (
              <div>
                <div className="font-caption text-accent-cyan-soft">examples</div>
                <ul className="mt-2 space-y-1.5">
                  {exp.examples.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-[0.875rem] text-ink-muted">
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {exp.chunks && exp.chunks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] pt-3 text-[0.65rem] text-ink-faint">
                <span>Grounded in:</span>
                {exp.chunks.map((c, k) => (
                  <span
                    key={k}
                    className="rounded-pill bg-white/[0.04] px-1.5 py-0.5 font-mono"
                    title={c.doc_id}
                  >
                    {c.doc_id.slice(0, 6)}#{c.chunk_idx}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 0 && (
        <div>
          <div className="font-caption text-ink-muted">recent explanations</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {history.map((h) => (
              <button
                key={h.topic + h.ts}
                onClick={() => setTopic(h.topic)}
                className="rounded-pill border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[0.7rem] text-ink-muted hover:border-white/[0.14] hover:text-ink"
              >
                {h.topic}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
