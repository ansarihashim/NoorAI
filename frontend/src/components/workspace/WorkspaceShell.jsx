import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext.jsx'
import { PodcastSessionProvider } from './PodcastSessionContext.jsx'
import WorkspaceTopBar from './WorkspaceTopBar.jsx'
import SourcesPanel from './SourcesPanel.jsx'
import AIStudioPanel from './AIStudioPanel.jsx'
import PodcastTranscriptPanel from './PodcastTranscriptPanel.jsx'
import UploadCard from '../dashboard/UploadCard.jsx'
import Dialog from '../ui/Dialog.jsx'
import useMediaQuery, { BP } from '../../hooks/useMediaQuery.js'

/**
 * Persistent application shell — fully adaptive across viewports.
 *
 *   Desktop  (≥ 1024px):  three columns, both rails open by default.
 *   Tablet   (768–1023):  three columns, BUT the two rails are mutually
 *                         exclusive — opening one auto-collapses the other.
 *   Mobile   (< 768px):   center column is full-width; rails are FIXED
 *                         overlays that slide in from the edges, with a
 *                         backdrop. Both rails default to collapsed and
 *                         auto-close on route change.
 *
 * The mode is decided by `useMediaQuery`. Width values come from CSS vars
 * defined in index.css so future spacing changes live in one place.
 */
export default function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <PodcastSessionProvider>
        <ShellRoot />
      </PodcastSessionProvider>
    </WorkspaceProvider>
  )
}

function ShellRoot() {
  return (
    <div className="flex h-[100dvh] flex-col bg-page text-ink">
      <WorkspaceTopBar />
      <ShellBody />
      <UploadDialogMount />
    </div>
  )
}

/**
 * Shell-level upload dialog. Rendered once at the top of the workspace so
 * both rails can trigger it via `openUploadDialog()` from the workspace
 * context. On successful upload we close the dialog, refresh the docs
 * list, and navigate the user into the new session.
 */
function UploadDialogMount() {
  const { uploadDialogOpen, closeUploadDialog, refreshDocs } = useWorkspace()
  const navigate = useNavigate()
  function onUploaded(res) {
    closeUploadDialog()
    refreshDocs()
    if (res?.doc_id) navigate(`/app/session/${res.doc_id}`)
  }
  return (
    <Dialog
      open={uploadDialogOpen}
      onClose={closeUploadDialog}
      title="Upload a source"
      description="Drop a PDF or paste text. The page will be indexed for narration, revision, and Q&A."
      maxWidth="max-w-xl"
    >
      <UploadCard onUploaded={onUploaded} />
    </Dialog>
  )
}

function ShellBody() {
  const isMobile = useMediaQuery(BP.mobile)
  const isTablet = useMediaQuery(BP.tablet)
  return isMobile ? <MobileShell /> : <DesktopShell tablet={isTablet} />
}

/* ---------------- DESKTOP / TABLET (column layout) -------------------- */

function DesktopShell({ tablet }) {
  const {
    sourcesCollapsed, studioCollapsed,
    setSourcesCollapsed, setStudioCollapsed,
    activeMode,
  } = useWorkspace()
  const location = useLocation()
  const inSession = location.pathname.startsWith('/app/session/')
  const showTranscript = inSession && activeMode === 'podcast'

  // Tablet: enforce mutually-exclusive rails. Opening one closes the other.
  // We watch both flags and reconcile on every render — costs nothing.
  useEffect(() => {
    if (!tablet) return
    if (!sourcesCollapsed && !studioCollapsed) {
      // Both open on tablet — close the right rail by default.
      setStudioCollapsed(true)
    }
  }, [tablet, sourcesCollapsed, studioCollapsed, setStudioCollapsed])

  // Collapsed rails keep a thin (44px) icon strip so the user always knows
  // they exist — and so the only collapse affordance lives in one obvious
  // place (the strip itself), never as a duplicate overlay.
  const COLLAPSED_W = '44px'

  return (
    <div
      className="grid min-h-0 flex-1 bg-page"
      style={{
        gridTemplateColumns:
          `${sourcesCollapsed ? COLLAPSED_W : 'var(--shell-sources-w)'} ` +
          'minmax(0, 1fr) ' +
          `${studioCollapsed ? COLLAPSED_W : 'var(--shell-studio-w)'}`,
        transition: 'grid-template-columns 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* LEFT — Sources rail. When collapsed, render a slim icon strip in
          the SAME grid column so the main column expands; we never mount a
          floating duplicate panel. */}
      <aside className="relative min-h-0 overflow-hidden border-r border-rule bg-raised">
        {sourcesCollapsed ? (
          <CollapsedRail
            side="left"
            label="Sources"
            onExpand={() => setSourcesCollapsed(false)}
          />
        ) : (
          <SourcesPanel />
        )}
      </aside>

      {/* CENTER */}
      <main className="relative min-h-0 min-w-0 overflow-y-auto bg-page">
        <Outlet />
      </main>

      {/* RIGHT — AI Studio / Podcast transcript */}
      <aside className="relative min-h-0 overflow-hidden border-l border-rule bg-[#080808]">
        {studioCollapsed ? (
          <CollapsedRail
            side="right"
            label="AI Studio"
            onExpand={() => setStudioCollapsed(false)}
          />
        ) : (
          showTranscript ? <PodcastTranscriptPanel /> : <AIStudioPanel mode={activeMode} />
        )}
      </aside>
    </div>
  )
}

/* Collapsed-state side rail: 44px wide, vertical label + an expand chevron.
   Clicking ANYWHERE in the rail expands it — gives the user a big, obvious
   target so a collapsed sidebar never feels like a dead bar of bg colour. */
function CollapsedRail({ side, label, onExpand }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`Expand ${label}`}
      aria-label={`Expand ${label}`}
      className="group flex h-full w-full flex-col items-center gap-3 py-3 text-ink-dim transition-colors hover:bg-elevated hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {side === 'left'
          ? <path d="M9 6l6 6-6 6" />
          : <path d="M15 6l-6 6 6 6" />}
      </svg>
      <span
        className="select-none text-[0.62rem] font-mono uppercase tracking-[0.18em]"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {label}
      </span>
    </button>
  )
}

/* ---------------- MOBILE (overlay rails) ------------------------------ */

function MobileShell() {
  const {
    sourcesCollapsed, studioCollapsed,
    setSourcesCollapsed, setStudioCollapsed,
    activeMode,
  } = useWorkspace()
  const location = useLocation()
  const inSession = location.pathname.startsWith('/app/session/')
  const showTranscript = inSession && activeMode === 'podcast'

  // Both rails default to closed on mobile. The shell context state is
  // shared across viewports, so we force-close on first mobile render.
  useEffect(() => {
    setSourcesCollapsed(true)
    setStudioCollapsed(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-close any open rail when the route changes (e.g. user picks a
  // page from the index — the index closes itself).
  useEffect(() => {
    setSourcesCollapsed(true)
    setStudioCollapsed(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // ESC closes whichever rail is open.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (!sourcesCollapsed) setSourcesCollapsed(true)
      if (!studioCollapsed) setStudioCollapsed(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sourcesCollapsed, studioCollapsed, setSourcesCollapsed, setStudioCollapsed])

  // Lock body scroll while a rail is open so the sheet feels modal.
  const aRailOpen = !sourcesCollapsed || !studioCollapsed
  useEffect(() => {
    if (!aRailOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [aRailOpen])

  return (
    <div className="relative min-h-0 flex-1 bg-page">
      {/* CENTER — full width on mobile */}
      <main className="relative h-full min-h-0 min-w-0 overflow-y-auto bg-page">
        <Outlet />
      </main>

      {/* Backdrop — covers the center while a rail is up */}
      <AnimatePresence>
        {aRailOpen && (
          <motion.div
            key="rail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => { setSourcesCollapsed(true); setStudioCollapsed(true) }}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* LEFT rail — slide-in overlay */}
      <AnimatePresence>
        {!sourcesCollapsed && (
          <motion.aside
            key="m-sources"
            role="dialog"
            aria-label="Notebook index"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-rule bg-raised shadow-floatSoft"
          >
            <SourcesPanel />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* RIGHT rail — slide-in overlay */}
      <AnimatePresence>
        {!studioCollapsed && (
          <motion.aside
            key="m-studio"
            role="dialog"
            aria-label={showTranscript ? 'Podcast transcript' : 'AI studio'}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[min(86vw,360px)] flex-col border-l border-rule bg-[#080808] shadow-floatSoft"
          >
            {showTranscript ? <PodcastTranscriptPanel /> : <AIStudioPanel mode={activeMode} />}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
