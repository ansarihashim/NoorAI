# EchoVerse — Product Brief

> A self-contained product summary, theory only. No code, no APIs, no file
> paths. Hand this to a designer (human or LLM) so they understand *what*
> EchoVerse is and *what state* it's in before they design a single screen.

---

## 1. The product, in one paragraph

**EchoVerse is an AI-native, immersive study and revision operating system.**
A learner uploads a single document — a PDF, a chapter, lecture notes —
and EchoVerse turns it into multiple ways to learn the same material:
listen to it being narrated aloud and interrupt it with voice questions,
hear it as a host-and-guest podcast, see it as a diagram, drill it with
flashcards and quizzes, and prepare for an exam across many documents at
once. The product is meant to feel like a **calm, cinematic workspace for
the mind**, not a dashboard, not a chat box, not a tool palette.

---

## 2. Who it's for

A self-directed learner — a student, a professional preparing for a
certification, a researcher reading something dense. They oscillate
through four moods, sometimes in a single sitting:

1. **Deep focus** — reading a chapter on headphones, fully present.
2. **Passive learning** — listening on a commute or while walking.
3. **Active retrieval** — flashcards, quizzes, reciting answers aloud.
4. **Strategic exam prep** — across multiple documents, looking for
   patterns and likely questions.

The product must move between these moods without fragmenting into four
different apps.

---

## 3. The core idea

Most study tools treat the document as **content**. EchoVerse treats the
document as **a study partner**: something you can listen to, interrupt,
ask, summarise, visualise, drill, and cross-reference. The same upload
should feel different depending on the *mood the learner is in*, not the
*tool the learner clicks*.

This is why the workspace has **modes**, not pages.

---

## 4. The five modes (each owns one mood)

Each mode lives inside one shared workspace called a **Session**. The
Session is anchored to a single document; switching modes never reloads
the page, never breaks playback, and the workspace's atmosphere subtly
shifts to communicate the mode change.

### 4.1 Narration mode — *deep focus*

The document is read aloud paragraph-by-paragraph in a natural voice. The
learner can speak *into* the narration to ask a question; the narrator
pauses, EchoVerse answers using only the document's own contents, and
narration resumes from where it stopped. The reading pane scrolls
automatically to the paragraph being narrated. The user can click any
paragraph to jump to it, scrub the timeline, or skip ahead.

This is the heart of the product. The first 30 seconds of any new user's
experience should be: upload → see the doc on screen → hit play → hear it
aloud → speak naturally → get an answer → go back to listening.

### 4.2 Podcast mode — *passive learning*

The same document is rewritten as a **two-voice conversation** between a
host and a guest. They riff on the material with analogies and
back-and-forth. Each speaker has a distinct voice. The transcript
synchronises with playback, with the active speaker highlighted and turns
visually rhythmed so the eye can tell who's talking at a glance.

### 4.3 Visualize mode — *concept mapping*

The learner types what they want to see (a flowchart, mind map, roadmap,
sequence, dependency graph) and EchoVerse generates a diagram from the
document. Past diagrams persist as a history rail; the active diagram is
embedded in the workspace, downloadable as SVG.

### 4.4 Revision mode — *active retrieval*

A set of focused, distraction-free practice modalities. Each one is a
sub-mode the learner switches into:

- **Flashcards** — tap to flip, arrow keys to advance, bookmark weak
  cards. Designed to feel like a physical deck.
- **Quiz** — multiple-choice / conceptual / assertion-reason questions,
  one at a time, with reveal-on-pick and explanations grounded in the
  document.
- **Active Recall** — the user is asked to *think first*, then click to
  reveal. The UI should encourage thinking before peeking.
- **Quick Revision** — TL;DR-style topic summaries for fast passes.
- **Night Before** — the high-yield essentials, condensed for the eve of
  an exam.
- **Visual Revision** — concept maps tuned for revision (not free-form
  diagramming).
- **Viva** — spoken oral practice; the learner answers aloud and gets
  feedback. Reuses the same voice loop as Narration mode.

### 4.5 Preparation mode — *strategic exam prep*

This mode operates over **multiple documents at once**. The learner picks
two, three, ten documents and asks questions of the whole set:

- **Overview** — what topics matter, how they relate, what the dependency
  structure looks like (rendered as a knowledge map).
- **Important Questions** — questions most likely to come up, ranked.
- **Simplest Explanation** — pick a topic, get an explain-like-I'm-12
  treatment grounded in the selected documents.

This is where EchoVerse stops feeling like a "document reader" and starts
feeling like an exam-intelligence layer.

---

## 5. The shared workspace

Wrapping all five modes is a single Session shell:

- **A slim command bar** at the top with: a back-to-Library breadcrumb,
  the document title, a centred mode switcher (purple = narration, cyan
  = podcast, green = visualize, amber = revision, rose = preparation),
  and a live status indicator on the right (when the AI is listening,
  thinking, speaking, etc.).
- **An atmospheric aura** behind the body that's tinted to match the
  current mode. Switching modes crossfades the aura.
- **A body that takes the full remaining height** and reshapes itself per
  mode — never card-stacked, never dashboard-y.

The rest of the app — Dashboard, Library, Settings — exists only to *get
the user into a Session as quickly as possible* and *get back out
gracefully*.

---

## 6. The non-Session pages

### Landing
A premium marketing surface introducing the product. Should feel like the
homepage of a thoughtful AI startup, not a generic SaaS template. Single
hero, slow ambient orb behind, two-mode showcase, three-step "how it
works", a single CTA.

### Login / Signup
Calm, centred, minimal. Fits the same aesthetic as the rest of the app.

### Dashboard
The first thing a logged-in user sees. Three things:
1. **A personal greeting** ("Good morning, Aatif").
2. **A "Continue listening" card** if they have an in-progress session.
3. **The upload affordance** — drag-drop a file or paste text — and a
   grid of recent documents below it.

### Library
Every document the user has uploaded, in a searchable, sortable grid.
Hover-reveal delete. Click to enter a Session.

### Settings
Voice preferences (host voice for narration), account info. Spartan.

---

## 7. The interaction philosophy

### Audio is tactile

Audio surfaces — the player, the speaker orbs, the seek bar — must feel
like instruments, not utility widgets. They should **breathe** when
playing, **settle** when paused, and respond to hover with finesse.

### Transcript is alive

In every audio mode, the transcript scrolls itself. The active line is
the brightest; lines further away fade. Click any line to jump to it.

### Voice is first-class

The user can speak at any time during narration or viva. The system has
a real finite state machine (`idle → listening → narrating → interrupted
→ thinking → speaking → resume`), and the UI reflects each state with a
small live indicator — no full-screen interruptions.

### Continuity over completeness

Switching modes never loses position. Pausing in chunk 7 of narration and
coming back tomorrow lands the user back at chunk 7. This deserves more
than a "Resume" button — it should feel like the workspace remembered
where the user was.

### One thing at a time

Inside a mode, the learner sees one primary thing — the reading pane,
the conversation, the diagram, the flashcard, the question — with
secondary controls quietly available. Never a wall of panels.

---

## 8. The aesthetic

**One sentence:** *quiet intelligence, immersive focus, fluid AI-native
workspace.*

- **Dark-first only.** No light theme.
- **Atmospheric, layered, soft, cinematic, spatial.**
- Subtle translucency. Layered depth. Premium typography. Smooth
  transitions. Intentional whitespace. Minimal borders. Elegant motion.
- A serif typeface for long-form reading prose. A clean sans for the UI.
  A monospace for timestamps and metadata.

**Avoid:** hard card borders everywhere; giant gradients that scream;
neon overload; glassmorphism spam; cluttered dashboards; chat-bubble UI;
"AI template" energy. The product should feel like it was designed by a
small team that cared, not generated by a wizard.

---

## 9. What's been built so far

### ✅ Built and working

- **Auth** — register, login, session persistence, protected routes.
- **Document upload** — drag-and-drop file (PDF / TXT / MD) or paste-text;
  documents are processed, chunked, and listed in the library.
- **Library** — view all uploaded documents, search by title, sort by
  recent / A–Z / largest, delete with confirmation.
- **Continue listening** — the dashboard surfaces the most recently
  played document and its position; one click resumes playback.
- **Voice preferences** — pick a host voice; voice previews available.

- **Narration mode** —
  - Real-time narration of the document in the chosen voice.
  - Reading pane with auto-scroll, click-paragraph-to-jump, distance-based
    paragraph fading, animated active-line cursor.
  - Voice interruption: speak into narration, narrator pauses, EchoVerse
    answers using only the document's contents, narration resumes.
  - Q&A transcript sidebar with role-tinted bubbles, mic-active indicator.
  - Full transport: play / pause / seek / speed (0.5×–2×) / volume / skip
    ±15s / next-prev chunk / keyboard shortcuts / OS lockscreen controls.

- **Podcast mode** —
  - On-demand generation of a host + guest discussion grounded in the
    document.
  - Two breathing speaker orbs with a pulsing aura on the active speaker.
  - Conversation stream with host left-aligned and guest right-aligned.
  - Synchronised transcript that scrolls and dims by distance from the
    active turn.
  - Same premium player as narration, with chapter chips coloured per
    speaker.

- **Visualize mode** —
  - Prompt-driven diagram generation (flowchart, mind map, sequence,
    architecture, etc.) grounded in the document.
  - Persistent diagram history per document.
  - Style selection (e.g. flow, mindmap, roadmap).
  - Download the rendered diagram as SVG.
  - Delete from history.

- **Revision mode** — all seven sub-modes wired up:
  - Flashcards (with bookmark)
  - Quiz (MCQ / conceptual / assertion-reason)
  - Active Recall
  - Quick Revision
  - Night Before
  - Visual Revision
  - Viva

- **Preparation mode** — all three sub-modes wired up across multiple
  selected documents:
  - Overview (topics + dependency graph)
  - Important Questions
  - Simplest Explanation (per topic)
  - DocPicker for choosing the working set.

- **Premium audio player** — chapter-aware seek bar with hover timestamp,
  speed control, volume control, ambient breathing waveform, transport,
  chapter chip strip.

- **Workspace shell** —
  - Five-mode switcher with springy active pill.
  - Mode-aware atmospheric aura that crossfades on mode switch.
  - Compact top nav inside Session, full top nav outside.
  - Slow-drift ambient horizon behind everything.
  - Per-mode CSS accent variable so child surfaces (player waveform, mode
    switcher glow) inherit the right colour.

- **Onboarding** — a first-run flow exists.

- **Toasts, dialogs, skeletons, focus rings, reduced-motion support** —
  all primitives in place.

### 🟡 Partially built / functionally-there-but-design-could-go-deeper

- **Audio reactivity** — the player's waveform breathes on a fixed
  rhythm; it isn't actually wired to amplitude. Good enough today, but a
  real audio-reactive layer is on the table.
- **Visualize embedding** — diagrams render correctly but feel "pasted
  in"; pan and zoom for large diagrams isn't there yet. Should feel
  premium and academic, not utility-grade.
- **Knowledge maps in Preparation** — Overview renders a Mermaid
  dependency graph, but the interaction layer (hover concepts, click to
  drill into, reorder by priority) is minimal.
- **Settings page** — is functional but visually thin. Voice picker
  works; everything else is bare.
- **Active Recall reveal** — works, but the "make the user think first"
  beat could be much more deliberate (delayed reveal, hint expansion,
  focus-only layout).
- **Flashcards** — work well; the *physical card* feel (3D flip, depth,
  tactile shadow) is partial.
- **Quiz** — functional MCQ flow; confidence sliders, post-quiz summary,
  weakness analysis are not present.
- **Viva** — wired up but the "spoken oral exam" stage presence (think:
  examiner asks, you answer, the system grades) is light.

### 🔴 Not built yet (open territory for the designer / next builder)

- **PYQ (Past-Year Questions) analysis** — topic frequency, importance
  heatmaps, prediction confidence, "likely-to-appear" markers, and a
  generated predicted paper. The brief asks for it; the product doesn't
  have it yet.
- **In-narration concept extraction** — surface "active concepts" or key
  terms in a side rail as the narrator passes them, with click-to-define.
- **In-narration personal notes** — let the user jot a note tied to the
  current paragraph; resurface it on the next listen.
- **Bookmarking inside narration / podcast** — only flashcards have
  bookmarks today. Bookmarking a paragraph or a podcast turn is
  obviously useful and not yet present.
- **Cross-mode handoff cues** — e.g. after finishing narration, prompt
  "want to drill the key concepts?" with a one-click jump into Revision.
- **Search inside a document** — currently the user can search the
  Library by title, but not the body of a document.
- **Multi-document ambient context** — Preparation operates on a doc set,
  but inside a single Session you can't reference *another* document.
- **Public sharing / read-only links** — a way to send a Session to a
  friend.
- **Mobile-first layout** — the current design assumes desktop; small
  screens work but aren't a priority surface yet.
- **Keyboard shortcut overlay** — a `?` cheatsheet listing every binding.
- **Quiz/recall analytics** — streaks, weak-topic tracking, spaced
  repetition scheduling.
- **Group / class mode** — a teacher uploads, a class joins. Not in
  scope but plausibly the future.

---

## 10. Design priorities for the next pass

If the designer can only land *some* of the work, this is roughly the
order of impact:

1. **Session shell polish** — atmosphere, mode-switcher feel, command bar
   restraint. The shell is the product's first impression every time the
   user enters a document.
2. **Reading pane (Narration)** — the typographic rhythm and active-line
   treatment is the single highest-leverage piece of polish in the app.
3. **Podcast conversation stream** — make host vs guest visually
   rhythmic; reject chat-bubble cliché.
4. **Audio player** — push the "Spotify meets AI tutor" feel further.
5. **Flashcard deck** — make it feel like a real, beautiful deck.
6. **Quiz one-question-at-a-time stage** — focus, reveal animation,
   confidence cues.
7. **Preparation Overview knowledge map** — academic, exploratory, not
   analytics.
8. **Visualize diagram surface** — embedded, premium, zoom/pan.
9. **Dashboard** — a calm, personal landing.
10. **Library** — restrained, fast, hoverable.
11. **Landing / Login / Signup** — premium first impression.

---

## 11. The one-line directive

> Design EchoVerse like a quiet, premium learning OS — dark, layered,
> cinematic, never noisy — and let interaction quality, not visual
> volume, do the talking.
