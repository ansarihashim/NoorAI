import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadFile, uploadText } from '../../lib/api.js'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Tabs from '../ui/Tabs.jsx'
import { useToast } from '../ui/Toast.jsx'
import { useSound } from '../../lib/sound.jsx'
import { NotebookEyebrow } from '../ui/NotebookSurface.jsx'

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
  const { play } = useSound()

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
    play('tap')
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
    <div className="nb-page nb-page--margin group relative p-6 sm:p-8">
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <NotebookEyebrow accent>open a new page</NotebookEyebrow>
          <h2 className="mt-2 font-serif text-[1.55rem] font-semibold leading-tight tracking-tight text-ink">
            What are you studying today?
          </h2>
          <p className="mt-1 text-[0.86rem] text-ink-dim">
            Drop a PDF or paste your notes — NoorAI reads it for you.
          </p>
        </div>
        <Tabs
          value={tab}
          onChange={(v) => { play('tap'); setTab(v) }}
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
                className="w-full resize-y rounded-lg border border-rule bg-page px-4 py-3 font-mono text-[0.85rem] leading-relaxed text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 hover:border-rule-strong focus:border-accent focus:shadow-[0_0_0_3px_rgba(255,214,10,0.25)]"
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
                'group relative flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 px-6 text-center transition-colors duration-150',
                dragging
                  ? 'border-accent bg-page'
                  : 'border-rule-strong bg-page hover:border-accent',
              ].join(' ')}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rule-strong bg-page text-accent transition-colors duration-150 group-hover:border-accent group-hover:text-accent-soft">
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

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-end">
        <Button onClick={submit} disabled={!canSubmit} loading={busy} size="lg">
          {busy ? 'Indexing' : 'Open the page'}
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
