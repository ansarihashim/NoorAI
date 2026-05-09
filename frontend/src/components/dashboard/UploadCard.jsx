import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadFile, uploadText } from '../../lib/api.js'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Tabs from '../ui/Tabs.jsx'
import { useToast } from '../ui/Toast.jsx'

const ACCEPT = '.txt,.md,.pdf'
const ACCEPT_MIME = ['text/plain', 'text/markdown', 'application/pdf']

export default function UploadCard({ onUploaded }) {
  const [tab, setTab] = useState('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const toast = useToast()

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) acceptFile(f)
  }, [])

  function acceptFile(f) {
    const okExt = /\.(txt|md|pdf)$/i.test(f.name)
    const okMime = ACCEPT_MIME.includes(f.type) || f.type === ''
    if (!okExt && !okMime) {
      toast.error('Unsupported file', 'Use a .txt, .md, or .pdf file.')
      return
    }
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      const res =
        tab === 'paste'
          ? await uploadText({ title: title || 'Untitled', text })
          : await uploadFile({ title: title || file?.name || 'Untitled', file })
      onUploaded?.(res)
    } catch (err) {
      toast.error('Upload failed', err?.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !busy && (tab === 'paste' ? text.trim().length > 0 : Boolean(file))
  const charCount = text.length

  return (
    <div className="glass relative overflow-hidden p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="font-caption text-ink-muted">new document</span>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink">
            What are we studying today?
          </h2>
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'paste', label: 'Paste text' },
            { value: 'file', label: 'Upload file' },
          ]}
        />
      </div>

      <div className="mt-6">
        <Input
          label="Title"
          placeholder="Optional — we'll guess from your file"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'paste' ? (
          <motion.div
            key="paste"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-4"
          >
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
              Notes
            </span>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Drop in a few paragraphs of your notes — anything from a chapter summary to a lecture transcript…"
                className="w-full resize-y rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 font-mono text-[0.85rem] leading-relaxed text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent-purple/50 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
              />
              <div className="pointer-events-none absolute bottom-2.5 right-3.5 font-mono text-[0.7rem] text-ink-faint">
                {charCount.toLocaleString()} chars
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-4"
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={[
                'group relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 text-center transition-all',
                dragging
                  ? 'border-accent-purple/60 bg-accent-purple/[0.07] shadow-[0_0_0_6px_rgba(139,92,246,0.08)]'
                  : 'border-white/[0.10] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.04]',
              ].join(' ')}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 text-accent-purple-soft ring-1 ring-white/[0.06]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v12" />
                </svg>
              </span>
              {file ? (
                <>
                  <span className="text-sm font-medium text-ink">{file.name}</span>
                  <span className="font-mono text-[0.7rem] text-ink-muted">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-ink">Drop a file or click to browse</span>
                  <span className="text-xs text-ink-muted">.pdf, .txt, .md — up to a few MB</span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-muted">
          We'll chunk and embed it locally so narration starts immediately.
        </p>
        <Button onClick={submit} disabled={!canSubmit} loading={busy} size="lg">
          {busy ? 'Processing' : 'Continue'}
          {!busy && (
            <svg viewBox="0 0 24 24" className="ml-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  )
}
