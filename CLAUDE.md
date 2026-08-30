# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

This project is a teaching application targeted toward a student working on CCSS 2.MD.C.8 as the capstone standard. The lesson's focus is: "Understand how to combine two numbers, represented by groups of objects (2 balls and 3 balls) and count the total." The objects/shapes used may vary (they need not be balls), and the implementation approach for this lesson has not been decided yet. Once the lesson is finished, the student may play the multiplayer coin counting game.

## Multiplayer game description

Each player is presented with their own group of coins to count. Once a player answers correctly, that coin amount is added to the "total money" — a single running total of every coin amount any player has ever guessed correctly, shared across the whole game. Players may join and leave at will; the player list updates live for everyone as people come and go. A game room holds up to 20 players at once.

## Commands

`firebase-tools` is a devDependency, not installed globally — run it as `npx firebase <command>` (e.g. `npx firebase deploy`, `npx firebase emulators:start`), not a bare `firebase` command.

## Tech Stack

- **Animation:** GSAP, for animations and sequencing the lesson's pacing. GSAP is used for visuals only — it must never be the source of truth for lesson or multiplayer game state (e.g. which step the student is on, whether an answer gates progression). See the `gsap-svelte-cleanup` skill for a required cleanup pattern when using GSAP inside Svelte components (tweens/timelines must be killed on component unmount to avoid memory leaks).
- **Hosting:** Firebase Hosting.
- **Multiplayer sync:** Firebase Realtime Database (RTDB), scoped to live multiplayer game session state.
- **Student progress persistence:** not stored in Firebase at this stage. Lesson/problem progress is saved locally in IndexedDB, with a reset-progress button in the options menu. Firestore is not needed for now.
- **Multiplayer authoritative state:** lightweight Firebase Cloud Functions are being explored as a single source of truth for multiplayer game state, specifically to prevent client-side sync/visual inconsistencies that could confuse the student. Not yet implemented.
- **Multiplayer threat model:** the multiplayer game has no chat, player profiles, or player-to-player communication. Malicious actors and score manipulation are out of scope at this stage — no anti-cheat or security hardening is needed yet.
- **Auth:** Firebase Anonymous Auth for players. No teacher/admin authorization exists yet.
- **Crash/error monitoring:** Firebase Crashlytics does not support Web (only Android/iOS/Flutter/Unity/NDK), so this app uses Firebase Performance Monitoring plus logging caught exceptions as Analytics events instead.

## Problem set versioning

Every lesson's content class declares a `problemSetVersion` (see `LessonContent` in `src/lessons/lessonContent.ts`) covering its `problems` array alone. Whenever a problem is added, removed, or edited (prompt, groups, answer), increment that lesson's `problemSetVersion`. The answer-evaluation recorder stamps this version on every finding it records, so logged evaluation data always identifies which revision of the problem set the student was answering.

## Workflow

Do not open a pull request when finishing a task. Instead, verify locally that the change is ready to be merged into `main` (tests pass, build/lint clean, diff reviewed), then explicitly alert the user with an input request that it's ready to merge — do not merge it yourself.

## Current state

When building the lesson and multiplayer game features, use the `pedagogy-review` skill to check the instructional design (scaffolding, feedback loops, difficulty progression) against the CCSS 2.MD.C.8 target.
