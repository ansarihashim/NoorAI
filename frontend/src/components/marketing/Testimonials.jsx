import { motion, useReducedMotion } from 'framer-motion'
import { SectionHeader } from './primitives.jsx'

const REVIEWS = [
  {
    quote:
      "I stopped re-reading my notes. I just listen to the podcast version on my walk to college and ask questions when something doesn't click. It feels like a tutor who already read my chapter.",
    name: 'Aarav M.',
    role: '4th year · Biotechnology',
    rating: 5,
  },
  {
    quote:
      "Night-before mode saved me. Twenty minutes of focused recall and I knew exactly what I'd forgotten and why. My short-answers section finally stopped being random.",
    name: 'Priya S.',
    role: '2nd year · Medicine',
    rating: 5,
  },
  {
    quote:
      'I have ADHD and reading PDFs is genuinely hard for me. Having NoorAI narrate while I follow along — and being able to interrupt — is the first study tool that actually fits how my brain works.',
    name: 'Daniel K.',
    role: 'MSc · Computer Science',
    rating: 5,
  },
  {
    quote:
      "The simplify mode is unreal. I dropped a research paper into it, asked it to explain it like I'm in undergrad, and got a version I could actually understand. Then I could ask follow-ups out loud.",
    name: 'Mei L.',
    role: '3rd year · Economics',
    rating: 5,
  },
  {
    quote:
      "I prep my viva voce sessions using the viva drill. It asks me the same kinds of questions a panel would, and it doesn't let me get away with vague answers.",
    name: 'Hashim A.',
    role: 'Final year · Law',
    rating: 5,
  },
  {
    quote:
      "Honestly didn't expect a 'study app' to feel premium. The narration voice is calm, the workspace is calm, and somehow that's made me sit with my notes longer.",
    name: 'Sara N.',
    role: '1st year · Architecture',
    rating: 5,
  },
]

function Stars({ n = 5 }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-echo-accent">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={['h-3.5 w-3.5', i < n ? '' : 'opacity-25'].join(' ')} fill="currentColor">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  )
}

function Avatar({ name }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-echo-border bg-gradient-to-br from-echo-accent/30 to-echo-accent/5 text-[0.72rem] font-semibold text-echo-text">
      {initials}
    </span>
  )
}

function Card({ review, i }) {
  const reduce = useReducedMotion()
  return (
    <motion.figure
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      animate={reduce ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative break-inside-avoid rounded-2xl border border-echo-border bg-echo-surface/50 p-6 backdrop-blur-md transition-colors duration-500 hover:border-echo-accent/30"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(135deg, rgba(217,160,102,0.10), transparent 60%)',
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Stars n={review.rating} />
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-echo-accent/30" fill="currentColor">
            <path d="M9 7H5a2 2 0 00-2 2v4a2 2 0 002 2h2v3a2 2 0 01-2 2H4v2h1a4 4 0 004-4V9a2 2 0 00-2-2zm10 0h-4a2 2 0 00-2 2v4a2 2 0 002 2h2v3a2 2 0 01-2 2h-1v2h1a4 4 0 004-4V9a2 2 0 00-2-2z" />
          </svg>
        </div>
        <blockquote className="mt-4 font-serif text-[1rem] leading-relaxed text-echo-text">
          &ldquo;{review.quote}&rdquo;
        </blockquote>
        <figcaption className="mt-5 flex items-center gap-3 border-t border-echo-border pt-4">
          <Avatar name={review.name} />
          <div className="flex flex-col">
            <span className="text-[0.86rem] font-medium text-echo-text">{review.name}</span>
            <span className="text-[0.74rem] text-echo-muted">{review.role}</span>
          </div>
        </figcaption>
      </div>
    </motion.figure>
  )
}

export default function Testimonials() {
  return (
    <section className="relative px-5 py-32 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Loved by quiet learners"
          title={
            <>
              Less doom-scrolling notes.{' '}
              <span className="echo-text-warm">More actually understanding them.</span>
            </>
          }
          subtitle="Built for students who want to come out of a study session feeling clearer, not more tired."
        />

        <div className="mt-16 columns-1 gap-5 md:columns-2 lg:columns-3 [&>*]:mb-5">
          {REVIEWS.map((r, i) => (
            <Card key={r.name} review={r} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
