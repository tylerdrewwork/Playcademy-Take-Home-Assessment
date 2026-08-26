# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

This project is a teaching application targeted toward a student working on CCSS 2.MD.C.8 as the capstone standard. In the lesson, the student sorts a group of coins from highest value to lowest value, or lowest to highest value. Once the lesson is finished, the student may play the multiplayer coin counting game.

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
- `src/App.svelte` is currently the default Vite/Svelte template placeholder (lorem ipsum copy, a hero image, and three buttons that only `console.log` on click) — not yet the coin-sorting lesson or game UI.
- `src/app.css` holds global styles; component-scoped styles live in each `.svelte` file's `<style>` block.
- `src/assets/` is for assets imported by components (bundled by Vite); `public/` is for static assets served as-is at the site root.

## Current state

There is no coin-sorting lesson, quiz/assessment flow, or multiplayer coin counting game implemented yet — only the stock scaffold described above. When building these features, use the `pedagogy-review` skill to check the instructional design (scaffolding, feedback loops, difficulty progression) against the CCSS 2.MD.C.8 target.
