import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getQuiz } from '../../lib/api.js'
import useRevisionStream from '../../hooks/useRevisionStream.js'
import { useCitations } from '../../lib/citations.jsx'
import { useToast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import Dialog from '../ui/Dialog.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import StreamingList from './StreamingList.jsx'

const N_OPTIONS = [8, 12, 16, 24]

const TYPE_LABEL = {
  mcq: 'MCQ',
  conceptual: 'Conceptual',
  assertion_reason: 'Assertion · Reason',
}

export default function QuizView({ docId, action }) {
  const toast = useToast()
  const citations = useCitations()
  const [quiz, setQuiz] = useState(null) // null=loading, undefined=none, QuizSet=loaded
  const [n, setN] = useState(12)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState({})       // { [questionIdx]: optionIdx }
  const [revealed, setRevealed] = useState(new Set()) // questionIdx revealed

  const {
    items: streamItems, isStreaming, isDone, error, total, startStream, reset,
  } = useRevisionStream(docId, 'quiz')

  useEffect(() => {
    if (!docId) return
    let cancelled = false
    ;(async () => {
      try {
        const q = await getQuiz(docId)
        if (!cancelled) setQuiz(q)
      } catch (err) {
        if (!cancelled) {
          if (err?.status === 404) setQuiz(undefined)
          else { setQuiz(undefined); toast.error('Quiz failed to load', err?.message) }
        }
      }
    })()
    return () => { cancelled = true }
  }, [docId, toast])

  // Stream finished → load the canonical saved set (fallback to streamed items).
  useEffect(() => {
    if (!streaming || !isDone) return
    let cancelled = false
    ;(async () => {
      try {
        const q = await getQuiz(docId)
        if (!cancelled) { setQuiz(q); setIdx(0); setPicked({}); setRevealed(new Set()) }
      } catch {
        if (!cancelled && streamItems.length) {
          setQuiz({ title: quiz?.title || 'Quiz', questions: streamItems })
          setIdx(0); setPicked({}); setRevealed(new Set())
        }
      }
      if (!cancelled) setStreaming(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, streaming])

  const beginStream = useCallback((opts) => { setStreaming(true); startStream(opts) }, [startStream])
  const onGenerate = useCallback(() => { if (!streaming) beginStream({ n }) }, [streaming, n, beginStream])
  const onRegen = useCallback(() => { if (quiz) setConfirmRegen(true); else onGenerate() }, [quiz, onGenerate])
  const performRegen = useCallback(() => { setConfirmRegen(false); beginStream({ n, force: true }) }, [n, beginStream])
  const onTryAgain = useCallback(() => { reset(); beginStream({ n }) }, [reset, n, beginStream])

  // Right-rail "Start quiz" trigger.
  useEffect(() => {
    if (!action || !action.generate) return
    if (streaming || quiz === null) return
    if (quiz === undefined) onGenerate()
    else setConfirmRegen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action])

  const stats = useMemo(() => {
    if (!quiz) return { answered: 0, correct: 0, total: 0 }
    let correct = 0
    let answered = 0
    for (const i of revealed) {
      answered++
      const q = quiz.questions[i]
      if (q && q.type !== 'conceptual' && picked[i] === q.correct_index) correct++
    }
    return {
      answered,
      correct,
      total: quiz.questions.filter((q) => q.type !== 'conceptual').length,
    }
  }, [quiz, revealed, picked])

  if (quiz === null && !streaming) {
    return (
      <div className="grid place-items-center py-16">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[280px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (streaming) {
    return (
      <StreamingList
        label="quiz"
        items={streamItems}
        isStreaming={isStreaming}
        isDone={isDone}
        error={error}
        total={total}
        onTryAgain={onTryAgain}
        noneLabel="No questions were produced."
        renderItem={(qq) => (
          <>
            <p className="text-[0.9rem] font-medium leading-snug text-ink">{qq.question}</p>
            <p className="mt-1.5 text-[0.75rem] uppercase tracking-[0.08em] text-ink-faint">
              {TYPE_LABEL[qq.type] || qq.type}
            </p>
          </>
        )}
      />
    )
  }

  if (quiz === undefined) {
    return <EmptyState n={n} onN={setN} onGenerate={onGenerate} />
  }

  const q = quiz.questions[idx]
  const isMcqOrAR = q.type === 'mcq' || q.type === 'assertion_reason'
  const isRevealed = revealed.has(idx)

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <span className="font-caption text-ink-muted">quiz</span>
          <h2 className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.5rem]">
            {quiz.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <NPill value={n} onChange={setN} disabled={false} />
          <Button onClick={onRegen} variant="secondary" size="sm">
            Regenerate
          </Button>
        </div>
      </motion.div>

      {/* Score row */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[0.8rem]">
        <span className="font-mono tabular-nums text-ink-muted">
          Question {idx + 1} / {quiz.questions.length}
        </span>
        <span className="text-ink-muted">
          {stats.answered > 0
            ? <>Score: <span className="font-medium text-ink">{stats.correct} / {stats.total}</span></>
            : 'No questions answered yet'}
        </span>
      </div>

      {/* Question card */}
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-strong relative overflow-hidden p-6 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-pill border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
            {TYPE_LABEL[q.type] || q.type}
          </span>
          <span className="font-mono text-[0.65rem] text-ink-faint">
            {citations.format(q.grounded_chunks || [])}
          </span>
        </div>
        <p className="mt-4 text-pretty text-[1.05rem] leading-relaxed text-ink">{q.question}</p>

        {/* Options for MCQ / Assertion-Reason */}
        {isMcqOrAR && (
          <div className="mt-5 space-y-2">
            {q.options.map((opt, i) => {
              const isPicked = picked[idx] === i
              const isCorrect = i === q.correct_index
              const showResult = isRevealed
              return (
                <button
                  key={i}
                  onClick={() => !isRevealed && setPicked((p) => ({ ...p, [idx]: i }))}
                  disabled={isRevealed}
                  className={[
                    'group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[0.9rem] transition-all',
                    showResult
                      ? isCorrect
                        ? 'border-accent-green/40 bg-accent-green/[0.10] text-ink'
                        : isPicked
                          ? 'border-accent-rose/40 bg-accent-rose/[0.08] text-ink'
                          : 'border-white/[0.06] bg-white/[0.02] text-ink-muted'
                      : isPicked
                        ? 'border-accent-purple/50 bg-accent-purple/[0.10] text-ink'
                        : 'border-white/[0.07] bg-white/[0.02] text-ink-muted hover:border-white/[0.16] hover:text-ink',
                  ].join(' ')}
                >
                  <span className={[
                    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-medium',
                    showResult && isCorrect
                      ? 'border-accent-green bg-accent-green text-bg'
                      : showResult && isPicked
                        ? 'border-accent-rose bg-accent-rose text-bg'
                        : isPicked
                          ? 'border-accent-purple bg-accent-purple text-white'
                          : 'border-white/[0.15] text-ink-muted',
                  ].join(' ')}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Reveal / explanation */}
        <div className="mt-5">
          {!isRevealed ? (
            <Button
              variant={picked[idx] != null || !isMcqOrAR ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setRevealed((s) => new Set([...s, idx]))}
              disabled={isMcqOrAR && picked[idx] == null}
            >
              {q.type === 'conceptual' ? 'Show model answer' : 'Reveal answer'}
            </Button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/[0.06] bg-bg-panel/40 p-4"
              >
                <div className="font-caption text-ink-muted">explanation</div>
                <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-muted">{q.explanation}</p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          ← Previous
        </Button>
        <ProgressDots total={quiz.questions.length} idx={idx} answered={revealed} picked={picked} questions={quiz.questions} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.min(quiz.questions.length - 1, i + 1))}
          disabled={idx >= quiz.questions.length - 1}
        >
          Next →
        </Button>
      </div>

      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate the quiz?"
        description={`This replaces the ${quiz.questions.length}-question quiz with a fresh ${n}-question one. Your score on the current quiz will reset.`}
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
          <Button variant="primary" onClick={performRegen}>Regenerate</Button>
        </div>
      </Dialog>
    </div>
  )
}

function ProgressDots({ total, idx, answered, picked, questions }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === idx
        const wasAnswered = answered.has(i)
        const q = questions[i]
        const correct = q && q.type !== 'conceptual' && picked[i] === q.correct_index
        return (
          <span
            key={i}
            className={[
              'h-1.5 rounded-full transition-all',
              isCurrent ? 'w-6' : 'w-1.5',
              isCurrent
                ? 'bg-gradient-to-r from-accent-purple to-accent-cyan'
                : wasAnswered
                  ? q.type === 'conceptual'
                    ? 'bg-accent-cyan/60'
                    : correct
                      ? 'bg-accent-green/60'
                      : 'bg-accent-rose/60'
                  : 'bg-white/[0.10]',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}

function NPill({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-white/[0.07] bg-white/[0.02] p-1">
      {N_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={disabled}
          aria-pressed={opt === value}
          className={[
            'h-7 rounded-pill px-2.5 font-mono text-[0.7rem] tabular-nums transition-colors',
            opt === value ? 'bg-white/[0.10] text-ink' : 'text-ink-muted hover:text-ink',
            disabled ? 'opacity-50' : '',
          ].join(' ')}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ n, onN, onGenerate }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-cyan/30 to-accent-purple/20 text-accent-cyan-soft ring-1 ring-white/[0.08]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17.5v.01" />
          </svg>
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">
          Generate a quiz from this document.
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink-muted">
          Mix of MCQs, conceptual prompts, and assertion-reason — every answer cites the chunks it came from.
        </p>
        <div className="mt-6 inline-flex items-center gap-3">
          <NPill value={n} onChange={onN} disabled={false} />
          <Button onClick={onGenerate} size="lg">
            Generate {n} questions
          </Button>
        </div>
      </div>
    </div>
  )
}
