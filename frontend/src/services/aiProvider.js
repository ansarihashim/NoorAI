/**
 * Hybrid AI provider.
 *
 * Every API call the frontend makes goes through this module. When
 * `DEMO_MODE` is on, requests resolve from local fixtures with realistic
 * latency. Otherwise they fall through to the real `lib/api.js`
 * implementations (`realApi`).
 *
 * The UI cannot tell the difference — the resolved payload shape matches
 * the backend's response in either case.
 *
 *   import { provider } from './aiProvider.js'
 *   const docs = await provider.listDocuments()
 *
 * Adding a new endpoint: add a method here that branches on DEMO_MODE.
 */
import * as realApi from '../lib/api.js'
import { DEMO_MODE, DEMO_USER, sleepFor } from '../config/demo.js'
import { DEMO_DOCS, findDoc } from '../demo/topics/index.js'
import { getOverview }    from '../demo/preparation/overviews.js'
import { getQuestions }   from '../demo/preparation/questions.js'
import { getExplanation } from '../demo/preparation/explanations.js'
import {
  getFlashcards, getQuiz, getRecall, getQuick, getNight, getViva,
} from '../demo/revision/index.js'
import { listVisuals, getVisual, generateVisual } from '../demo/visuals/index.js'
import { getPodcast } from '../demo/podcast/index.js'
import { getManifest, getCitations } from '../demo/narration/index.js'

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Stable in-memory store for ad-hoc demo state (e.g. cached generations
 *  during the same browser session). Survives navigations, gone on refresh. */
const memo = new Map()

function memoize(key, build) {
  if (memo.has(key)) return memo.get(key)
  const v = build()
  memo.set(key, v)
  return v
}

// ---------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------

export const provider = {
  /** Whether we're routing to demo fixtures. */
  isDemo() { return DEMO_MODE },

  // -------- auth --------
  // Auth is special-cased in lib/auth.jsx (it doesn't go through the
  // provider) because the AuthProvider needs the demo path before any
  // network call. Keep this here only for symmetry.
  async me() {
    if (DEMO_MODE) return DEMO_USER
    return realApi.me()
  },

  // -------- documents --------

  async listDocuments() {
    if (DEMO_MODE) {
      await sleepFor('documentsList')
      return DEMO_DOCS
    }
    return realApi.listDocuments()
  },

  async getDoc(docId) {
    if (DEMO_MODE) {
      await sleepFor('citations')
      const d = findDoc(docId)
      if (!d) throw new realApi.ApiError(404, 'doc not found')
      return {
        doc_id:    d.id,
        title:     d.title,
        n_rag:     d.n_chunks,
        n_narration: d.n_chunks,
        total_pages: d.total_pages,
      }
    }
    return realApi.getDoc(docId)
  },

  async getDocumentCitations(docId) {
    if (DEMO_MODE) {
      await sleepFor('citations')
      return getCitations(docId) || { pages: [], total_pages: null, is_paged: false }
    }
    return realApi.getDocumentCitations(docId)
  },

  // Upload is demo-disabled: a portfolio visitor shouldn't have a real
  // backend that accepts file writes. We surface a friendly toast-style
  // error so the UI handles it as a normal validation failure.
  async uploadText({ title, text }) {
    if (DEMO_MODE) {
      await sleepFor('uploadIndex')
      throw new realApi.ApiError(403, 'Demo Workspace is read-only — upload disabled. Open any of the seeded topics on the left.')
    }
    return realApi.uploadText({ title, text })
  },

  async uploadFile({ title, file }) {
    if (DEMO_MODE) {
      await sleepFor('uploadIndex')
      throw new realApi.ApiError(403, 'Demo Workspace is read-only — upload disabled. Open any of the seeded topics on the left.')
    }
    return realApi.uploadFile({ title, file })
  },

  async deleteDocument(docId) {
    if (DEMO_MODE) {
      throw new realApi.ApiError(403, 'Demo Workspace is read-only — delete disabled.')
    }
    return realApi.deleteDocument(docId)
  },

  // -------- voices --------
  async listVoices() {
    if (DEMO_MODE) {
      return [
        { id: 'demo-host',     name: 'Aria',  tone: 'warm',     gender: 'female', suggested_role: 'host' },
        { id: 'demo-guest',    name: 'Atlas', tone: 'measured', gender: 'male',   suggested_role: 'guest' },
        { id: 'demo-narrator', name: 'Lyra',  tone: 'clear',    gender: 'female', suggested_role: 'narrator' },
      ]
    }
    return realApi.listVoices()
  },

  // -------- narration --------
  async getNarrationManifest(docId, voiceId) {
    if (DEMO_MODE) {
      await sleepFor('citations')
      const m = getManifest(docId, voiceId)
      if (!m) throw new realApi.ApiError(404, 'doc not found')
      return m
    }
    return realApi.getNarrationManifest(docId, voiceId)
  },

  narrationChunkUrl(docId, idx, voiceId) {
    // Demo audio is synthesised client-side via lib/demoTts.js — the chunk
    // URL is never actually fetched in demo mode. Return a stable string so
    // the audio element's `src` change still triggers re-mount.
    if (DEMO_MODE) return `demo://narration/${docId}/${idx}`
    return realApi.narrationChunkUrl(docId, idx, voiceId)
  },

  async prefetchNarration(docId, indices, voiceId) {
    if (DEMO_MODE) {
      // No-op: no remote files to warm.
      return { ok: true, prefetched: indices.length }
    }
    return realApi.prefetchNarration(docId, indices, voiceId)
  },

  // -------- visuals --------
  async listVisuals(docId) {
    if (DEMO_MODE) return listVisuals(docId)
    return realApi.listVisuals(docId)
  },

  async generateVisual(docId, opts) {
    if (DEMO_MODE) {
      await sleepFor('visualGen')
      const v = generateVisual(docId, opts)
      if (!v) throw new realApi.ApiError(404, 'doc not found')
      return v
    }
    return realApi.generateVisual(docId, opts)
  },

  async getVisual(docId, visualId) {
    if (DEMO_MODE) {
      const v = getVisual(docId, visualId)
      if (!v) throw new realApi.ApiError(404, 'visual not found')
      return v
    }
    return realApi.getVisual(docId, visualId)
  },

  async deleteVisual(docId, visualId) {
    if (DEMO_MODE) {
      throw new realApi.ApiError(403, 'Demo Workspace is read-only.')
    }
    return realApi.deleteVisual(docId, visualId)
  },

  // -------- podcast --------
  async getPodcast(docId) {
    if (DEMO_MODE) {
      await sleepFor('citations')
      const p = getPodcast(docId)
      if (!p) throw new realApi.ApiError(404, 'podcast not found')
      return p
    }
    return realApi.getPodcast(docId)
  },

  async generatePodcast(docId) {
    if (DEMO_MODE) {
      await sleepFor('podcastGen')
      const p = getPodcast(docId)
      if (!p) throw new realApi.ApiError(404, 'podcast not found')
      return p
    }
    return realApi.generatePodcast(docId)
  },

  podcastTurnUrl(docId, idx) {
    if (DEMO_MODE) return `demo://podcast/${docId}/${idx}`
    return realApi.podcastTurnUrl(docId, idx)
  },

  // -------- preparation (multi-doc) --------
  async getOverview(docIds)            { return DEMO_MODE ? (await sleepFor('citations'), getOverview(docIds))    : realApi.getOverview(docIds) },
  async generateOverview(docIds)       { if (!DEMO_MODE) return realApi.generateOverview(docIds); await sleepFor('overviewGen'); return memoize(`ov:${docIds.join(',')}`, () => getOverview(docIds)) },
  async deleteOverview(docIds)         { if (DEMO_MODE) { memo.delete(`ov:${docIds.join(',')}`); return { ok: true } } return realApi.deleteOverview(docIds) },

  async getImportantQuestions(docIds)      { return DEMO_MODE ? (await sleepFor('citations'), getQuestions(docIds)) : realApi.getImportantQuestions(docIds) },
  async generateImportantQuestions(docIds) { if (!DEMO_MODE) return realApi.generateImportantQuestions(docIds); await sleepFor('questionsGen'); return memoize(`q:${docIds.join(',')}`, () => getQuestions(docIds)) },
  async deleteImportantQuestions(docIds)   { if (DEMO_MODE) { memo.delete(`q:${docIds.join(',')}`); return { ok: true } } return realApi.deleteImportantQuestions(docIds) },

  async getExplanation(docIds, topic)      { return DEMO_MODE ? (await sleepFor('citations'),    getExplanation(docIds, topic)) : realApi.getExplanation(docIds, topic) },
  async generateExplanation(docIds, topic) { if (!DEMO_MODE) return realApi.generateExplanation(docIds, topic); await sleepFor('explanationGen'); return getExplanation(docIds, topic) },

  // -------- revision (per-doc) --------
  async getFlashcards(docId)              { return DEMO_MODE ? getFlashcards(docId) : realApi.getFlashcards(docId) },
  async generateFlashcards(docId)         { if (!DEMO_MODE) return realApi.generateFlashcards(docId); await sleepFor('flashcardsGen'); return getFlashcards(docId) },
  async deleteFlashcards(docId)           { if (DEMO_MODE) return { ok: true }; return realApi.deleteFlashcards(docId) },

  async getQuiz(docId)                    { return DEMO_MODE ? getQuiz(docId) : realApi.getQuiz(docId) },
  async generateQuiz(docId)               { if (!DEMO_MODE) return realApi.generateQuiz(docId); await sleepFor('quizGen'); return getQuiz(docId) },
  async deleteQuiz(docId)                 { if (DEMO_MODE) return { ok: true }; return realApi.deleteQuiz(docId) },

  async getRecall(docId)                  { return DEMO_MODE ? getRecall(docId) : realApi.getRecall(docId) },
  async generateRecall(docId)             { if (!DEMO_MODE) return realApi.generateRecall(docId); await sleepFor('recallGen'); return getRecall(docId) },
  async deleteRecall(docId)               { if (DEMO_MODE) return { ok: true }; return realApi.deleteRecall(docId) },

  async getQuickRevision(docId)           { return DEMO_MODE ? getQuick(docId) : realApi.getQuickRevision(docId) },
  async generateQuickRevision(docId)      { if (!DEMO_MODE) return realApi.generateQuickRevision(docId); await sleepFor('quickGen'); return getQuick(docId) },
  async deleteQuickRevision(docId)        { if (DEMO_MODE) return { ok: true }; return realApi.deleteQuickRevision(docId) },

  async getNightBefore(docId)             { return DEMO_MODE ? getNight(docId) : realApi.getNightBefore(docId) },
  async generateNightBefore(docId)        { if (!DEMO_MODE) return realApi.generateNightBefore(docId); await sleepFor('nightGen'); return getNight(docId) },
  async deleteNightBefore(docId)          { if (DEMO_MODE) return { ok: true }; return realApi.deleteNightBefore(docId) },

  async getViva(docId)                    { return DEMO_MODE ? getViva(docId) : realApi.getViva(docId) },
  async generateViva(docId)               { if (!DEMO_MODE) return realApi.generateViva(docId); await sleepFor('vivaGen'); return getViva(docId) },
  async deleteViva(docId)                 { if (DEMO_MODE) return { ok: true }; return realApi.deleteViva(docId) },
}

export default provider
