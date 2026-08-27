# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

This project is a teaching application targeted toward a student working on CCSS 2.MD.C.8 as the capstone standard. The lesson's focus is: "Understand how to combine two numbers, represented by groups of objects (2 balls and 3 balls) and count the total." The objects/shapes used may vary (they need not be balls), and the implementation approach for this lesson has not been decided yet. Once the lesson is finished, the student may play the multiplayer coin counting game.

The codebase is currently the unmodified Svelte + Vite scaffold (see "Current state" below) — the lesson and multiplayer game described above have not been implemented yet.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start the Vite dev server (http://localhost:5173)
npm run build     # production build, output to dist/
npm run preview   # locally preview the production build in dist/
```

There is no test suite or linter configured in this repository yet.

## Architecture

- Stack: Svelte 5 + Vite, no framework router or state management library is installed.
- Entry point: `index.html` loads `src/main.js`, which calls Svelte 5's `mount()` to render `src/App.svelte` into `#app`.
- `src/App.svelte` is currently the default Vite/Svelte template placeholder (lorem ipsum copy, a hero image, and three buttons that only `console.log` on click) — not yet the lesson or game UI.
- `src/app.css` holds global styles; component-scoped styles live in each `.svelte` file's `<style>` block.
- `src/assets/` is for assets imported by components (bundled by Vite); `public/` is for static assets served as-is at the site root.

## Current state

There is no counting/combining lesson, quiz/assessment flow, or multiplayer coin counting game implemented yet — only the stock scaffold described above. When building these features, use the `pedagogy-review` skill to check the instructional design (scaffolding, feedback loops, difficulty progression) against the CCSS 2.MD.C.8 target.
