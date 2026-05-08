export default function MicButton({ active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition shadow-lg
        ${active ? 'bg-accent-cyan text-bg' : 'bg-white/10 text-slate-200 hover:bg-white/20'}
        disabled:opacity-50 disabled:cursor-not-allowed`}
      title={active ? 'Stop mic' : 'Start mic'}
    >
      {active && (
        <span className="absolute inset-0 rounded-full bg-accent-cyan/30 animate-ping" />
      )}
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 19v3" strokeLinecap="round" />
      </svg>
    </button>
  )
}
