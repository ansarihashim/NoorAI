# EchoVerse — Frontend Design Brief

> A self-contained briefing document for an LLM that will design or redesign
> EchoVerse's web frontend. It captures the product, the user, the data the
> frontend has to work with, the existing architecture, and the design
> direction — without dictating implementation details where they're better
> left to the designer.

---

## 1. Product, in one paragraph

**EchoVerse is an AI-native immersive study and revision operating system.**
A user uploads a PDF or pastes notes; EchoVerse turns that single document
into multiple ways to learn it: a real-time narration they can interrupt
with voice questions, a host-and-guest podcast discussion, AI-generated
diagrams, flashcards / quizzes / active recall / "night before" cram packs,
and multi-document exam preparation analytics. The user should feel
*guided, focused, and immersed* — not "given a dashboard."

**It is NOT:** a generic SaaS dashboard, an admin panel, a ChatGPT wrapper,
a template-generated UI, a Notion clone.

**It IS:** a calm, cinematic, dark-first workspace that progressively
reveals complexity as the learner asks for more.

---

## 2. Who uses it

A self-directed learner — student, professional studying for an exam,
researcher reading a dense paper. They oscillate between:

- **Deep focus** (reading a chapter, listening to narration on headphones)
- **Passive learning** (commute-time podcast)
- **Active retrieval practice** (flashcards, quizzes, active recall)
- **Exam preparation** (cross-document overview, predicted questions)

The design must serve all four moods from the same product without
fragmenting.

---

## 3. Tech stack & non-negotiables

| Layer | Tech |
|---|---|
| Framework | **React 18** (JS, not TS) + **Vite 6** |
| Routing | **react-router-dom v6** |
| Styling | **Tailwind v3** (no shadcn, no Radix, no Headless UI) |
| Motion | **framer-motion v12** (already a dependency) |
| Diagrams | **mermaid v11** (already used by Visualize mode) |
| Backend transport | REST + a single WebSocket for the live voice loop |

**Hard constraints from the product owner:**

- Do **not** introduce shadcn, Radix, Headless UI, MUI, Chakra, or any other
  component framework. The design system is hand-rolled in Tailwind on top
  of existing primitives.
- Do **not** redesign the underlying component architecture. Refine and
  evolve the existing primitives in `src/components/ui/`.
- Honor `prefers-reduced-motion` end-to-end.
- Dark-first only. There is no light theme.

---

## 4. Routes (current, owned by `App.jsx`)

| Path | Page | Notes |
|---|---|---|
| `/` | `Landing` | Marketing, public |
| `/login`, `/signup` | `Login`, `Signup` | Public, redirects authed users to `/app` |
| `/app` | `Dashboard` | Greeting + Continue Listening + Upload + recent docs |
| `/app/library` | `Library` | All uploaded documents, search/sort/delete |
| `/app/settings` | `Settings` | Voice preferences etc. |
| `/app/session/:docId` | `Session` | **The heart of the product** — see §6 |
| `/session/:docId` | redirect to `/app` | legacy |
| `*` | `NotFound` | |

All app routes are wrapped in `AppShell` which renders `TopNav` + a slow,
ambient horizon (drifting purple/cyan/green radial fields).

---

## 5. Backend API — what the frontend can render

Base URL: `VITE_API_BASE` (defaults to `http://localhost:8000`).
Auth: `Authorization: Bearer <jwt>` from `localStorage['echoverse.token']`.
Audio URLs are token-stamped (`?token=...`) so `<audio>` elements work without preflight.

### Auth
- `POST /api/auth/register`, `POST /api/auth/login` → `{ token, user }`
- `GET /api/auth/me` → `{ id, email, display_name }`

### Documents
- `POST /api/upload/text` `{ title, text }` → `{ doc_id, title, n_chunks, ... }`
- `POST /api/upload/file` (multipart `file`) → same
- `GET /api/upload/:docId` → `{ title, n_narration, n_narration_chunks, ... }`
- `GET /api/documents` → `[{ id, title, n_chunks, has_podcast, created_at }]`
- `DELETE /api/documents/:docId`

### Voices
- `GET /api/voices` → list of voice options
- `GET /api/voices/:voiceId/preview.mp3?token=...` (audio)

### Narration (Mode: read-aloud)
- `GET /api/narration/:docId/manifest?voice_id=...`
  → `{ doc_id, title, n_chunks, chunks: [{ idx, text, audio_ready }] }`
- `GET /api/narration/:docId/chunk/:idx.mp3?token=...&voice_id=...` (audio)
- `POST /api/narration/:docId/prefetch` `{ indices, voice_id }`
- **WebSocket** for the live voice loop:
  - JSON in/out: `{ type: 'state' | 'transcript' | 'interruption_dismissed' | 'flush_audio' | 'podcast_done' | 'error' | 'start_attend' | 'stop' }`
  - Binary in: 16 kHz int16 PCM mic frames (sent via `useMicStream`)
  - Binary out: ephemeral Q&A audio bytes (consumed by `useAudioPlayer`)
  - States: `idle → attending → narrating → interrupted → thinking → speaking → attending`

### Podcast (Mode: host + guest discussion)
- `GET /api/podcast/:docId` → `{ turns: [{ speaker: 'host'|'guest', text }] }` or 404
- `POST /api/podcast/:docId/generate` → same
- `GET /api/podcast/:docId/turn/:idx.mp3?token=...` (audio)

### Visuals (Mode: AI diagrams)
- `GET /api/visuals/:docId` → list of past visuals
- `POST /api/visuals/:docId/generate` `{ prompt, style }` → `{ visual_id, title, mermaid, diagram_type, style, prompt, created_at }`
- `GET /api/visuals/:docId/:visualId`
- `DELETE /api/visuals/:docId/:visualId`

### Revision (per-document)
All have the shape: `POST .../generate { n, force }`, `GET ...`, `DELETE ...`.

| Sub-mode | Endpoint root | Returns |
|---|---|---|
| Flashcards | `/api/revision/:docId/flashcards` | `{ title, cards: [{ front, back, citations }] }` |
| Quiz | `/api/revision/:docId/quiz` | `{ questions: [{ type: 'mcq'\|'conceptual'\|'assertion_reason', stem, options, correct_idx, explanation }] }` |
| Active Recall | `/api/revision/:docId/recall` | prompt-then-reveal questions |
| Quick Revision | `/api/revision/:docId/quick-revision` | TL;DR-style topic summaries |
| Night Before | `/api/revision/:docId/night-before` | high-yield essentials |
| Viva | `/api/revision/:docId/viva` | spoken-style oral practice |

There is also `VisualRevisionView` which leans on the visualize pipeline.

### Preparation (multi-document)
- `POST /api/preparation/overview/generate` `{ doc_ids, n_min, n_max, force }` → topics + dependency graph (mermaid)
- `POST /api/preparation/overview` (read), `/delete` (delete)
- `POST /api/preparation/questions/{generate,,delete}` → important questions across docs
- `POST /api/preparation/explanation/{generate,}` `{ doc_ids, topic }` → "explain like I'm 12" for a specific topic

---

## 6. Session — "the heart of the product"

`/app/session/:docId` is the workspace. It must NOT feel like a page with
stacked cards. It should feel like one continuous instrument that reshapes
itself around the current mode.

### Top-level mode switcher (5 modes)

| Mode | Accent | Purpose |
|---|---|---|
| **Narration** | purple `#8b5cf6` | Read-aloud + voice interruption + Q&A |
| **Podcast** | cyan `#22d3ee` | Two-voice discussion |
| **Visualize** | green `#34d399` | Mermaid diagrams from notes |
| **Revision** | amber `#fbbf24` | Flashcards / Quiz / Recall / etc. |
| **Preparation** | rose `#fb7185` | Multi-doc exam intelligence |

Each mode's accent should feed a CSS variable (`--mode-accent`) so child
components (player waveform, mode switcher glow, banners) can pick it up.

The mode switcher should:
- Live in a slim command bar at the top of the session
- Use a **shared-layout** pill that springs between modes (framer-motion `layoutId`)
- Be flanked on the left by `← Library` breadcrumb + truncated doc title,
  and on the right by a live state indicator (the WebSocket FSM state when
  in narration/podcast modes, the mode hint otherwise)

The body should crossfade when the mode changes (subtle, ≤350ms), and a
**mode-aware atmospheric aura** behind the body should crossfade with it.
Auras are layered radial gradients tinted by the mode accent — the user
should feel the room "shift colour" without seeing a hard surface change.

### Narration mode layout

```
┌──────────────────────────────────────────────────────┐
│ [optional inline banners — warn / interrupted]       │
├───────────────────────────────────────┬──────────────┤
│ Reading pane (focus, mask-faded edges)│ Sidebar:     │
│  - Distance-based opacity             │ Q&A          │
│  - Active line: gradient cursor + glow│ transcript / │
│  - Click any ¶ to jump                │ Mic state    │
├───────────────────────────────────────┴──────────────┤
│ Player bar (immersive — see §8)                       │
└──────────────────────────────────────────────────────┘
```

Reading pane typography: **serif** body for prose (Newsreader / Source Serif
Pro), `~1.115rem`, `1.75` line-height, ≤68ch column width, generous
vertical rhythm. Active paragraph gets a soft purple wash + a `3px`
gradient cursor line on the left edge that springs between paragraphs via
`layoutId="reading-cursor"`.

The Q&A sidebar (`TranscriptDrawer`) collapses to a 12px rail when closed.
When mic is active, show a pulsing dot in the rail header.

### Podcast mode layout

- Two **speaker orbs** at the top (host left, guest right). The active
  speaker's orb radiates a pulsing aura tinted to its accent, contains an
  audio-bar meter that breathes.
- Below: a **conversation stream** with host turns left-aligned and guest
  turns right-aligned (visual rhythm — not chat bubbles, but bubble-shaped
  cards with rounded asymmetric edges). Distance-based fade like the
  reading pane.
- Player bar with chapter chips colored host vs guest.

### Visualize mode layout

- Composer at top: prompt textarea + style chips + Generate button
- Main: rendered mermaid SVG (use existing `MermaidRenderer`). Should feel
  embedded, not pasted-in — soft container, no hard frame.
- Right rail: history of past diagrams. Hover-reveal delete.

### Revision mode layout

Sub-tabs (springy pill selector again): Flashcards · Quiz · Active Recall ·
Quick Revision · Night Before · Visual · Viva.

- **Flashcards** — full-width centred card deck. Tap to flip, ←/→ to move,
  `B` to bookmark. Smooth 3D flip.
- **Quiz** — one question at a time. MCQ / conceptual / assertion-reason.
  Reveal explanation after pick. Confidence indicator.
- **Active Recall** — prompt with a "think" delay before the reveal button
  is visible.
- **Quick Revision / Night Before** — list of high-yield topics, each
  collapsible.
- **Viva** — spoken-style oral practice (uses the same WebSocket loop).

### Preparation mode layout

Sub-tabs: Overview · Important Qs · Simplest Explanation. Has a multi-doc
**DocPicker** in the header that lets the user select one or more docs to
analyse together.

- **Overview** — topics list + a mermaid dependency graph showing prereq
  relationships. Should feel research-y, not analytics-y.
- **Important Questions** — predicted exam-likely questions with rationale.
- **Simplest Explanation** — pick a topic; get an explain-like-I'm-12
  treatment grounded in the selected docs.

---

## 7. Existing component primitives (don't replace, refine)

In `src/components/ui/`:

- `Button.jsx` — variants: `primary | secondary | ghost | outline | destructive`, sizes: `sm | md | lg | xl`. Uses framer-motion `whileTap`.
- `Pill.jsx` — tones: `neutral | purple | cyan | green | amber | rose`, optional pulsing dot.
- `Tabs.jsx` — controlled, springy `layoutId` underline.
- `Card.jsx` — passive or `interactive` (lifts on hover).
- `Dialog.jsx` — modal.
- `Input.jsx` — labeled text input.
- `Skeleton.jsx`, `Toast.jsx` (with `useToast()` hook), `Avatar.jsx`, `Logo.jsx`.

In `src/components/layout/`:

- `AppShell.jsx` — owns the ambient horizon and route-level page transition.
- `TopNav.jsx` — `variant="marketing" | "app"`, supports `compact={true}` inside Session.

Hooks worth knowing about:

- `useAudio` — chapter-aware HTML5 audio controller (the heart of all narration/podcast playback).
- `useAudioPlayer` — legacy MediaSource player kept ONLY for ephemeral Q&A audio.
- `useWebSocket` — single connection for the voice loop.
- `useMicStream` — mic capture via the `pcm-capture.js` AudioWorklet.
- `useMediaSession` — OS lockscreen / Bluetooth controls.
- `useKeyboardControls` — space/←/→/`B` etc.
- `useVoicePrefs` — picked host voice id.

Do not rewrite these hooks. The frontend's audio plumbing is correct.

---

## 8. Player — "Spotify meets AI tutoring"

Lives in `src/components/player/`. It's the lower band of Narration and
Podcast modes and must feel premium.

Required:
- Now-playing label (title + chapter/turn position)
- **Speed control** (0.5×–2×, dropdown that flips upward)
- **Volume control** (slider with mute toggle)
- **Chapter-aware seek bar:**
  - Click anywhere to seek
  - Hover shows a floating timestamp tooltip
  - Chapter ticks at boundaries
  - Current chapter span subtly highlighted under the progress fill
  - Progress fill is a glowing `purple → cyan` gradient
  - Thumb appears on hover/drag, scales up while dragging
- **Transport:** prev chapter · back 15s · **play (lg, primary)** · forward 15s · next chapter
- **Ambient SVG waveform** sitting just above the seek bar — bars breathe
  while playing, settle to a baseline when paused. NOT an analyser node;
  pure SVG so it stays cheap.
- Chapter chip strip below transport when chapters have labels, color-coded
  for host vs guest in podcast mode.
- Whole player is a "floating" surface — soft elevation, hairline border,
  large blur, ~85% opacity over the atmosphere.

---

## 9. Design language (the look)

### Mood

> Quiet intelligence. Immersive focus. Fluid AI-native workspace.

- **Dark-first**, atmospheric, layered, soft, cinematic, spatial.
- Subtle translucency, layered depth, premium typography, smooth
  transitions, intentional whitespace, minimal borders, elegant motion.

### What to avoid

- Hard card borders everywhere
- Giant gradients that scream
- Excessive glow / glassmorphism spam
- Cluttered layouts
- Visible chrome (too many buttons / pills / chips)
- Repetitive Tailwind-looking layouts (`rounded-xl border-white/10` on every box)
- Hacker / cyberpunk / neon overload aesthetics

### Color tokens (already configured in `tailwind.config.js`)

| Token | Value | Use |
|---|---|---|
| `bg.DEFAULT` / `surface.base` | `#070912` | Page floor |
| `surface.panel` | `#0d1126` | Panels in body |
| `surface.raised` | `#141833` | Raised panels |
| `surface.high` | `#1a1f44` | Most-elevated surfaces |
| `surface.float` | `#222858` | Floating dropdowns / dialogs |
| `ink.DEFAULT` | `#eaeefb` | Body text |
| `ink.muted` | `#9aa3c2` | Secondary text |
| `ink.dim` | `#5b6485` | Tertiary |
| `ink.faint` | `#383f5c` | Quaternary / hairlines |
| `accent.purple` `#8b5cf6` | Narration |
| `accent.cyan` `#22d3ee` | Podcast / "EchoVerse" assistant |
| `accent.green` `#34d399` | Visualize |
| `accent.amber` `#fbbf24` | Revision |
| `accent.rose` `#fb7185` | Preparation / destructive |

### Typography

- Sans: **Inter** (UI, headings, body in dashboards)
- Serif: **Newsreader** / Source Serif Pro (long-form reading pane)
- Mono: **JetBrains Mono** (timestamps, metadata)

Custom sizes already defined: `display`, `title`, `heading`, `body`, `prose`, `caption`, `eyebrow`. Use `eyebrow` (uppercase, tight) above headings — never as a button label.

### Surfaces (component classes already defined in `index.css`)

- `.surface-panel` — base panel (low elevation, low opacity, blur)
- `.surface-raised` — raised panel (more solid, more shadow)
- `.surface-floating` — floating elements (dialogs, dropdowns, the player)
- `.glass` / `.glass-strong` — legacy aliases of the above
- `.divider-soft` — gradient hairline divider
- `.eyebrow`, `.caption` — small uppercase label helpers
- `.shimmer` — skeleton shimmer animation

### Atmosphere

- `.mode-atmosphere--narration | --podcast | --visualize | --revision | --preparation` — full-bleed gradient washes for the Session body
- The body itself has a pre-baked atmospheric base + a slow `aurora-shift`
  drifting glow + a faint film grain
- An `AmbientHorizon` component inside `AppShell` adds three slow-moving
  blurred radial fields. Don't add MORE drifting lights; reuse these.

### Motion

Use framer-motion. Established easings:

- `ease-silk` — `cubic-bezier(0.22, 1, 0.36, 1)` — default for surfaces, layout
- `ease-expo` — `cubic-bezier(0.16, 1, 0.3, 1)` — for entrances
- Spring `{ stiffness: 380, damping: 32 }` — for `layoutId` pills

Rules:

- Motion guides attention or communicates continuity. Never decorative.
- ≤ 350ms for in-view changes; ≤ 600ms for atmospheric crossfades.
- Honor `prefers-reduced-motion`.
- Hover lifts: `y: -2` max. Tap scales: `0.94`–`0.97`.
- Use `layoutId` for any element that should appear to be the same object
  in two states (active tab pills, the reading cursor).

---

## 10. UX principles (from the product owner)

1. **Experience-first, not feature-first.** The UI should reveal complexity
   progressively. A first-time user should land in Narration with the
   reading pane front and centre and Play as the primary action.
2. **The product should feel alive, intelligent, and deeply intentional** —
   not AI-generated, template-like, overloaded, or generic.
3. **Calm > clever.** Intentional whitespace, restrained chrome.
4. **Audio-first when in narration/podcast.** All audio surfaces should
   feel tactile, breathing, responsive — never utility-grade.
5. **Pinch every interaction.** Hover states, focus rings, keyboard
   shortcuts, micro-loading states should all feel considered.
6. **One workspace, multiple modes.** The Session shell is shared; only
   the body changes. Atmosphere shifts to communicate the mode change.

---

## 11. What needs design love (priority list)

In rough order of impact:

1. **Session shell** — the command bar, mode switcher, atmospheric aura
   crossfades. Already partially built — refine the interaction quality.
2. **Reading pane** — typographic rhythm and active-line treatment is the
   single highest-impact piece of polish.
3. **PodcastView conversation stream** — the host/guest visual rhythm. Do
   NOT use chat bubbles. They should feel like narrative turns.
4. **PremiumPlayer** — refine the ambient waveform, seekbar interaction,
   and chapter chip strip.
5. **RevisionView · Flashcards** — full-screen, card-flip, swipe / arrow
   keys, distraction-free. This should feel like a physical deck.
6. **RevisionView · Quiz / Active Recall** — focus-first one-question-at-a-
   time layouts. Reveal animations matter here.
7. **PreparationView · Overview** — the dependency graph rendering. Should
   feel academic, not analytics.
8. **Visualize composer + diagram surface** — the diagram should feel
   embedded in the workspace, not pasted in.
9. **Dashboard** — Continue Listening card, Recent docs grid, ambient
   greeting.
10. **Library** — search + sort + grid. Restrained.
11. **Landing / Login / Signup** — premium marketing presence, single hero
    with subtle parallax orb.

---

## 12. Out of scope (don't touch)

- Any backend code under `backend/`.
- The audio plumbing inside `useAudio.js` / `useAudioPlayer.js` /
  `useMicStream.js` / `useWebSocket.js` / `useMediaSession.js` /
  `useKeyboardControls.js`.
- The Mermaid renderer internals.
- Auth flow logic in `src/lib/auth.jsx` (the visuals of Login/Signup are
  fair game; the state machine isn't).
- The `pcm-capture.js` AudioWorklet.

---

## 13. Quick "show me you read this" checklist for the designer

Before writing code, the designer should be able to answer:

- What's the difference between Session and Dashboard? *(One is workspace, the other is browse-and-launch.)*
- What are the five Session modes and what colour does each mode tint the workspace?
- Where does the WebSocket FSM state surface in the UI? *(The live pill on the right of the Session command bar, only in narration/podcast.)*
- Why is the reading pane serif and the rest sans? *(Long-form prose vs UI.)*
- What's the difference between `surface-panel`, `surface-raised`, `surface-floating`?
- What is `--mode-accent` and who reads it? *(A CSS var set by Session per mode; PremiumPlayer's waveform and the mode switcher's glow read it.)*

---

## 14. One-line directive

> Design EchoVerse like a quiet, premium learning OS — dark, layered,
> cinematic, never noisy — and let interaction quality, not visual
> volume, do the talking.
