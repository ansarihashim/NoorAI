import { useNavigate } from 'react-router-dom'
import UploadPanel from '../components/UploadPanel.jsx'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold mb-2">
          Your AI <span className="text-accent-cyan">study partner</span>
        </h1>
        <p className="text-slate-400">
          Upload notes. EchoVerse reads them aloud. Interrupt anytime — it answers from your own notes.
        </p>
      </div>

      <div className="glass p-6">
        <UploadPanel
          onUploaded={(doc) => navigate(`/session/${doc.doc_id}`, { state: { doc } })}
        />
      </div>
    </div>
  )
}
