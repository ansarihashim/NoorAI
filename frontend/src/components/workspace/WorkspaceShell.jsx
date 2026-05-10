import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext.jsx'
import { PodcastSessionProvider } from './PodcastSessionContext.jsx'
import WorkspaceTopBar from './WorkspaceTopBar.jsx'
import SourcesPanel from './SourcesPanel.jsx'
import AIStudioPanel from './AIStudioPanel.jsx'
import PodcastTranscriptPanel from './PodcastTranscriptPanel.jsx'

/**
 * Persistent 3-panel application shell.
 * Surfaces are solid; depth comes from hairline rules, not overlays.
 *   - app floor       : bg-page     (#050505)
 *   - left sidebar    : bg-raised   (#0B0B0B)
 *   - main workspace  : bg-page     (#050505)
 *   - right AI panel  : #080808
 */
export default function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <PodcastSessionProvider>
        <div className="flex h-screen flex-col bg-page text-ink">
          <WorkspaceTopBar />
          <ShellBody />
        </div>
      </PodcastSessionProvider>
    </WorkspaceProvider>
  )
}

function ShellBody() {
  const { sourcesCollapsed, studioCollapsed, activeMode } = useWorkspace()
  const location = useLocation()
  const inSession = location.pathname.startsWith('/app/session/')
  const showTranscript = inSession && activeMode === 'podcast'
  return (
    <div
      className="grid min-h-0 flex-1 bg-page"
      style={{
        gridTemplateColumns:
          `${sourcesCollapsed ? '0px' : 'var(--shell-sources-w)'} ` +
          'minmax(0, 1fr) ' +
          `${studioCollapsed ? '0px' : 'var(--shell-studio-w)'}`,
        transition: 'grid-template-columns 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* LEFT — Sources rail */}
      <AnimatePresence initial={false}>
        {!sourcesCollapsed && (
          <motion.aside
            key="sources-rail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="relative min-h-0 overflow-hidden border-r border-rule bg-raised"
          >
            <SourcesPanel />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CENTER — Main workspace. Solid surface, no overlays. */}
      <main className="relative min-h-0 min-w-0 overflow-y-auto bg-page">
        <Outlet />
      </main>

      {/* RIGHT — AI panel */}
      <AnimatePresence initial={false}>
        {!studioCollapsed && (
          <motion.aside
            key={showTranscript ? 'podcast-rail' : 'studio-rail'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="relative min-h-0 overflow-hidden border-l border-rule bg-[#080808]"
          >
            {showTranscript ? <PodcastTranscriptPanel /> : <AIStudioPanel mode={activeMode} />}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
