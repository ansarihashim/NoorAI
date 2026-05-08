import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Session from './pages/Session.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          <span className="text-accent-purple">Echo</span>
          <span className="text-accent-cyan">Verse</span>
        </Link>
        <span className="text-xs text-slate-400">Real-Time Bidirectional AI Voice Agent</span>
      </header>
      <main className="flex-1 px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/:docId" element={<Session />} />
        </Routes>
      </main>
    </div>
  )
}
