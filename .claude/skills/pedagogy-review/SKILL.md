---
name: pedagogy-review
description: Use when discussing pedagogy, curriculum design, student learning experiences, scaffolding, guided learning, lesson flow, quizzes/assessments, hints, or difficulty progression — reviews the learning methods being implemented and flags instructional-design issues, missing feedback loops, or scaffolding gaps.
---

# Pedagogy Review

## Overview

Features that shape how a student learns are instructional design, not just UX. A flow can be bug-free, fast, and pretty while still teaching badly. Apply this lens whenever a learning mechanism is on the table — even in passing conversation, not only when someone explicitly asks for a "review."

## When to Use

Applies to: lesson/curriculum sequencing, quiz or assessment design, hints and feedback text, scaffolding or guided practice, difficulty/pacing progression, onboarding for learners, gamification or rewards tied to learning, adaptive or personalized paths.

Does not apply to: UI polish, styling, or infra work that doesn't touch how a student learns.

## Review Lens

Check the design against each principle. Lead with what's missing or risky — don't just list what's fine.

| Principle | Check | Red flag |
|---|---|---|
| Prior-knowledge diagnostic | Can a learner who already knows the material test out or skip? | Forced linear path, no diagnostic or skip |
| Scaffolding & fading (ZPD) | Is support present early and withdrawn gradually? | Content dumped straight into high-stakes assessment, no worked examples or guided practice |
| Cognitive load | How much new material lands before any check or practice? | Many new concepts back-to-back with no chunking or interleaved practice |
| Feedback quality | Is feedback immediate, specific, and actionable? | Generic "incorrect, try again" with no explanation; feedback delayed to the end of a long sequence |
| Formative vs. summative balance | Are there low-stakes checks along the way? | Only one high-stakes gate; no practice checkpoints |
| Mastery & retry design | Can a learner fix one mistake without redoing unrelated work? | Full restart on any failure; no partial credit or targeted remediation |
| Retrieval & spacing | Are concepts revisited over time? | Everything front-loaded once, never revisited |
| Motivation & autonomy | Does the learner have real choice/control? | Purely linear path; points/streaks standing in for genuine competence signal |
| Transfer | Does practice resemble the real task, not just recognition? | Quiz tests recall only, no applied practice |
| Differentiation & pacing | Can different learners move at different speeds? | Uniform pacing, no skip-ahead or adjustable difficulty |
| Progress legibility | Can the learner tell where they are and what's left? | Coarse indicator that hides within-task state |
| Accessibility of the method itself | Does the format advantage some learners arbitrarily? | Single modality, punitive timing, no accommodation for pace/processing differences |

## How to Flag Findings

For each gap found, state it as: **principle — what you observed — why it hurts learning (one sentence) — smallest fix.** Rank by how much it damages learning outcomes or drives drop-off, not by how easy it is to fix.

## Common Mistakes

- Reviewing only for bugs/UX polish and skipping the instructional-design lens entirely.
- Treating "other platforms do it this way" as sufficient justification.
- Praising engagement mechanics (streaks, badges, points) without checking they aren't substituting for an actual learning or feedback signal.
- Waiting to be asked "review this" instead of surfacing pedagogy issues as they come up in normal design discussion.
