import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listDocuments } from '../../lib/api.js'

/**
 * Shared workspace state — lives once, at the WorkspaceShell level, so the
 * Sources rail, the Mode body, and the AI Studio rail all read/write the
 * same source of truth without a re-render storm during audio playback.
 */
const WorkspaceCtx = createContext(null)

const SCOPE_KEY = 'echoverse.activeSources'

function loadActiveScope() {
  try {
    const raw = localStorage.getItem(SCOPE_KEY)
    if (!raw) return null
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : null
  } catch { return null }
}

function persistActiveScope(scope) {
  try { localStorage.setItem(SCOPE_KEY, JSON.stringify([...scope])) } catch { /* no-op */ }
}

export function WorkspaceProvider({ children }) {
  const [docs, setDocs] = useState(null)         // null = loading, [] = empty
  const [docsError, setDocsError] = useState(null)
  const [activeScope, setActiveScope] = useState(() => loadActiveScope() ?? new Set())
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false)
  const [studioCollapsed, setStudioCollapsed] = useState(false)
  // Held here (not in Session) so AIStudioPanel + ModeRail + Session all
  // agree on which cognitive mode is active without re-render storms.
  const [activeMode, setActiveMode] = useState('preparation')

  // Load docs once at shell mount; refresh exposed for upload completion.
  const refreshDocs = useCallback(async () => {
    try {
      const list = await listDocuments()
      setDocs(list)
      setDocsError(null)
      return list
    } catch (err) {
      setDocsError(err)
      setDocs([])
      return []
    }
  }, [])

  useEffect(() => { refreshDocs() }, [refreshDocs])

  const toggleSource = useCallback((docId) => {
    setActiveScope((cur) => {
      const next = new Set(cur)
      if (next.has(docId)) next.delete(docId); else next.add(docId)
      persistActiveScope(next)
      return next
    })
  }, [])

  const setSourceActive = useCallback((docId, active) => {
    setActiveScope((cur) => {
      const next = new Set(cur)
      if (active) next.add(docId); else next.delete(docId)
      persistActiveScope(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({
    docs, docsError, refreshDocs,
    activeScope, toggleSource, setSourceActive,
    sourcesCollapsed, setSourcesCollapsed,
    studioCollapsed, setStudioCollapsed,
    activeMode, setActiveMode,
  }), [docs, docsError, refreshDocs, activeScope, toggleSource, setSourceActive,
       sourcesCollapsed, studioCollapsed, activeMode])

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}
