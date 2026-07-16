import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import usePreparationStream from '../../hooks/usePreparationStream.js'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'

const SAMPLE_TOPICS = [
  'Attention mechanism',
  'Why transformers replaced RNNs',
  'How RAG grounds an LLM',
  'Reinforcement learning, in one paragraph',
]

export default function ExplanationView({ docIds, action }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [topic, setTopic] = useState('')
  const [currentTopic, setCurrentTopic] = useState('')
  const [history, setHistory] = useState([])

  const { text, isStreaming, isDone, error, startStream, reset } =
    usePreparationStream(docIds, 'explanation')

  // Right-rail "Simplify a topic" — focus the input.
  useEffect(() => {
    if (!action) return
    if (action.action !== 'simplify-topic') return
    inputRef.current?.focus()
  }, [action])

  const onExplain = useCallback(
    (override) => {
      const t = (typeof override === 'string' ? override : topic).trim()
      if (!t) {
        toast.error('Tell me what to explain', 'Try "attention mechanism"')
        return
      }
      if (isStreaming) return
      setCurrentTopic(t)
      setHistory((cur) => [{ topic: t, ts: Date.now() }, ...cur.filter((h) => h.topic !== t)].slice(0, 8))
      startStream({ topic: t })
    },
    [topic, isStreaming, toast, startStream],
  )

  const onTryAgain = useCallback(() => {
    if (!currentTopic) return
    reset()
    startStream({ topic: currentTopic })
  }, [currentTopic, reset, startStream])

  const showCard = isStreaming || isDone || error

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-caption text-ink-muted">simplest explanation</span>
        <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
          Explain a topic like I'm new to it.
        </h2>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          Pick (or type) a topic — NoorAI explains it in beginner-friendly language, drawn only from your notes, typed out as it thinks.
        </p>
      </div>

      {/* Composer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type a topic (e.g. Attention mechanism)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onExplain()
            }
          }}
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent-purple/50"
        />
        <Button onClick={() => onExplain()} loading={isStreaming} size="md">Explain</Button>
      </div>

      {!showCard && (
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

      {/* Explanation card — prose types in live */}
      <AnimatePresence mode="wait">
        {showCard && (
          <motion.div
            key={currentTopic}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-strong space-y-4 p-6 sm:p-7"
          >
            <div>
              <span className="font-caption text-ink-muted">explaining</span>
              <h3 className="mt-1 text-[1.05rem] font-semibold text-ink">{currentTopic}</h3>
            </div>

            {error ? (
              <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/[0.06] p-4">
                <p className="text-[0.9rem] text-ink">Generation failed.</p>
                <p className="mt-1 text-[0.8rem] text-ink-muted">{error}</p>
                <Button className="mt-3" size="sm" variant="secondary" onClick={onTryAgain}>Try again</Button>
              </div>
            ) : (
              <p className="text-pretty text-[0.95rem] leading-relaxed text-ink">
                {text}
                {isStreaming && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-accent-purple-soft align-baseline" />
                )}
              </p>
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
                onClick={() => { setTopic(h.topic); onExplain(h.topic) }}
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
