# Playcademy-Take-Home-Assessment

A Svelte 5 + Vite teaching application built with the goal of reaching CCSS 2.MD.C.8. Once the lesson is complete, the student can join a Firebase-backed multiplayer coin-counting game.

## Getting started

```bash
npm install
```

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (defaults to http://localhost:5173) |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest test suite |
| `npm run check` | Type-check the project with `svelte-check` |
| `npm run generate:voice-clips` | Generate lesson/game voice clips via the voice-clips-generator tool |
| `npm run generate:voice-clips:numbers` | Generate voice clips for spoken numbers only |
| `npm run clean:voice-clips` | Remove generated voice clips |
| `npm run deploy` | Deploy hosting (excluding functions) from `firebase/` via `npx firebase deploy` |

`firebase-tools` is a devDependency, so Firebase CLI commands should be run with `npx firebase <command>` rather than a globally installed `firebase`.

## Project structure

- `index.html` / `src/main.js` — Vite entry point and Svelte app mount
- `src/App.svelte`, `src/app.css` — root component and global styles
- `src/lessons/` — lesson flow, progress tracking, and evaluation
  - `lessonContent.ts` — lesson content registry (`LessonContent`, `problemSetVersion`)
  - `content/` — per-lesson content, screens, and evaluators (e.g. `addition-1-*`)
  - `evaluation/` — answer-evaluation recording, storage, and behavioral detectors
  - `progression.ts`, `progressStorage.ts` — lesson progression and IndexedDB-backed persistence
- `src/multiplayer/` — multiplayer coin-counting game UI and client-side session state
- `src/lib/firebase.js` — Firebase app/client initialization
- `src/assets/` — images, audio, and other static assets used by the app
- `public/` — static assets served as-is
- `firebase/` — Firebase project config, hosting output, and RTDB rules
  - `firebase/functions/` — Cloud Functions (`joinGame`, `submitAnswer`) that authoritatively manage multiplayer state
- `tools/voice-clips-generator/` — script for generating spoken-word voice clip assets
- `design/` — design mockups and canvases
- `docs/` — audits, plans, and specs

## Tech stack

- **Frontend framework:** Svelte 5 + Vite
- **Language:** TypeScript (plus some JavaScript)
- **Animation:** GSAP
- **Testing:** Vitest
- **Hosting:** Firebase Hosting
- **Multiplayer sync:** Firebase Realtime Database (RTDB)
- **Multiplayer authoritative logic:** Firebase Cloud Functions
- **Student progress persistence:** IndexedDB (local, per-device)
- **Auth:** Firebase Anonymous Auth
- **Monitoring:** Firebase Performance Monitoring, with caught exceptions logged as Analytics events
