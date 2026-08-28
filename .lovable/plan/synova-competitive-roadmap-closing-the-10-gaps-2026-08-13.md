# SYNOVA Competitive Roadmap — Closing the 10 Gaps

Based on a scan of 22 competing platforms (Khanmigo, Gemini Guided Learning, ChatGPT Study Mode, Photomath, Symbolab, Wolfram, Quizlet, Duolingo Max, NotebookLM, Physics Wallah, Embibe, ALLEN, Unacademy, Doubtnut, Vedantu, MagicSchool, SchoolAI and others) and an inventory of what SYNOVA already ships.

Phase 1 covers the four features you picked, in build order. Phases 2-4 sequence the remaining six gaps.

---

## Phase 1 — The four picked features

### 1.1 Adaptive spaced-repetition queue

The retention lever. Every returning user lands on "you have N items due today".

- New tables: `review_items` (one row per topic/question a student has studied, with SM-2 fields: `ease_factor`, `interval_days`, `repetitions`, `due_at`, `lapses`) and `review_logs` (each grade recorded, for analytics).
- Items are seeded automatically whenever a student finishes a tutor session, a homework session, a PYQ explanation, or a curriculum topic — reusing the existing progress-tracking hooks rather than asking the student to create cards.
- New `/review` page: shows the due queue, one item at a time. AI generates the recall question from the stored topic; student answers; self-grades Again / Hard / Good / Easy. SM-2 recomputes the next due date.
- Dashboard gets a "Due today" card above the fold with the count and a start button.
- Weak topics (from the existing adaptive-learning memory) get a shorter starting interval so they resurface faster.
- XP awards on review completion, hooked into the existing badge/streak system.

### 1.2 Timed mock tests with scoring and rank prediction

Matches Embibe / ALLEN / Unacademy's core hook. The `practice_tests` table already exists but has no test-taking experience on top of it.

- New tables: `mock_tests` (config: exam type, subjects, question count, duration, marking scheme), `mock_test_questions` (drawn from existing `pyq_questions` plus AI-generated fill-ins), `mock_test_attempts` (answers, per-question time, score, percentile).
- New `/mock-test` flow: setup screen (exam, subjects, difficulty, duration) → full-screen timed test runner with a question palette, mark-for-review, and a persisted timer that survives refresh → auto-submit at zero.
- Marking follows real exam schemes (JEE +4/-1, NEET +4/-1, boards no negative).
- Result report: score, accuracy, time per question, subject-wise and topic-wise breakdown, and the weakest chapters fed straight back into the review queue from 1.1.
- Rank/percentile prediction: percentile computed against the pool of all attempts on the same test; when the pool is thin, fall back to a published cutoff-based estimate and label it clearly as an estimate. No fabricated rank numbers.

### 1.3 Student notes upload with grounded study

A NotebookLM-class feature nobody in Indian exam prep ships. Today only teachers can upload PDFs.

- New tables: `student_documents` and `student_document_chunks` with a pgvector embedding column.
- New `/my-notes` page: student uploads a PDF or pastes notes → text is extracted, chunked, and embedded via the Lovable AI Gateway.
- Grounded chat over the selected document(s): retrieval finds the relevant chunks, and the tutor answers strictly from them with a page or section citation, saying plainly when the answer is not in the source.
- One-click generation from any document: flashcards (which flow into the 1.1 review queue) and a practice quiz.
- Storage quota per student, and the same strict `auth.uid()` ownership rules used elsewhere.

### 1.4 Symbolic math verification layer

Directly addresses the accuracy problem you already hit. This is what makes Wolfram and Symbolab trusted.

- The AI is instructed to emit a machine-checkable expression for the final answer alongside the human-readable solution.
- A verification step evaluates that expression symbolically and compares it to the stated final answer.
- On mismatch, the solve is retried once with the discrepancy fed back; if it still fails, the answer is shown with an honest "couldn't independently verify this" note rather than a false confidence badge.
- On match, the answer shows a "verified" indicator.
- Applied to the numeric modes first: Snap-Solve, Homework, Tutor, PYQ explain.

---

## Phase 2 — Engagement and reach

- **Auto-generated flashcards and quizzes on every lesson.** An "Add to review" and "Quiz me" action on any AI explanation across all modes, feeding the Phase 1.1 queue. Small work once 1.1 and 1.3 exist.
- **Escalate to teacher.** A button inside any chat that packages the conversation into a help request for the linked teacher, extending the existing `student_help_requests` flow. Competitors buy this with human tutors; you already have real teachers in the system.
- **Real offline support.** Service worker with an app shell, cached lessons and review items, and a queued-write outbox so the app is usable on a weak Tier 2/3 connection. Photomath solves offline; Indian rivals are app-first.

## Phase 3 — Content moat

- **Grow the question bank.** AI-generated, teacher-reviewed questions tagged by exam, subject, chapter and difficulty, plus a bulk-import path. Competitors advertise crore-scale banks; the counter is calibrated quality with visible provenance.
- **Trust and outcome proof on the landing page.** Real, verifiable counters (questions solved, topics covered, verified-answer rate) and genuine student outcomes as they accumulate. No invented topper claims.

## Phase 4 — Business

- **Monetization.** Freemium: generous free tier, paid tier unlocking unlimited mock tests, larger note storage and priority AI. Pricing tuned to Indian willingness-to-pay, following the affordable-disruptor positioning.
- **Native mobile.** Wrap the PWA for app-store presence once offline support lands.

---

## Technical notes

- All new tables get GRANTs plus strict `auth.uid()`-scoped RLS, matching the existing security posture. Educators see progress and weak topics, never private conversations.
- New edge functions: `review-queue` (SM-2 scheduling and question generation), `mock-test` (assembly, scoring, percentile), `notes-ingest` (extract, chunk, embed) and `notes-chat` (retrieval-grounded answering). All reuse the existing auth, rate-limit and deterministic AI settings.
- Embeddings via `google/gemini-embedding-001` through the Lovable AI Gateway, stored in pgvector with an HNSW index.
- Symbolic verification runs inside the edge function; no new external service.
- New routes are lazy-loaded and added to the prefetch list and sidebar, matching current patterns.

## Suggested build order

Phase 1.1 first (unblocks 1.2's weak-topic feedback and 1.3's flashcards), then 1.4 (small, high trust payoff), then 1.2, then 1.3. Each is independently shippable.
