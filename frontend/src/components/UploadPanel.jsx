import { useState } from 'react'
import { uploadText, uploadFile } from '../lib/api'

export default function UploadPanel({ onUploaded }) {
  const [tab, setTab] = useState('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    setBusy(true)
    try {
      const res =
        tab === 'paste'
          ? await uploadText({ title: title || 'Untitled', text })
          : await uploadFile({ title, file })
      onUploaded(res)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    !busy && (tab === 'paste' ? text.trim().length > 0 : !!file)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('paste')}
          className={`btn ${tab === 'paste' ? 'bg-accent-purple text-white' : 'btn-ghost'}`}
        >
          Paste text
        </button>
        <button
          onClick={() => setTab('file')}
          className={`btn ${tab === 'file' ? 'bg-accent-purple text-white' : 'btn-ghost'}`}
        >
          Upload file
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full px-3 py-2 bg-white/5 rounded-lg border border-white/10 outline-none focus:border-accent-purple"
      />

      {tab === 'paste' ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your notes here…"
          rows={10}
          className="w-full px-3 py-2 bg-white/5 rounded-lg border border-white/10 outline-none focus:border-accent-purple font-mono text-sm"
        />
      ) : (
        <input
          type="file"
          accept=".txt,.md,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent-purple file:text-white hover:file:bg-accent-purple/90"
        />
      )}

      {error && <div className="text-sm text-red-400">{error}</div>}

      <button onClick={submit} disabled={!canSubmit} className="btn-primary">
        {busy ? 'Uploading…' : 'Start narration'}
      </button>
    </div>
  )
}
