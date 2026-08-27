---
name: gsap-svelte-cleanup
description: Use when writing or reviewing a Svelte component that creates GSAP tweens, timelines, or ScrollTrigger/Draggable instances — flags the memory-leak risk from animations that outlive the component and shows the cleanup pattern.
---

# GSAP + Svelte Cleanup

## Overview

GSAP tweens and timelines are not automatically tied to a Svelte component's lifecycle. If a component creates GSAP animations and unmounts before killing them, the tweens (and any DOM/closure references they hold) can leak — the animation keeps running or referencing a removed node, and memory isn't reclaimed. This is a known Svelte+GSAP integration pitfall, not a GSAP bug: GSAP has no idea a Svelte component was destroyed unless told.

This app unmounts components frequently (lesson steps, game rounds, menu transitions), so this is a real risk, not a theoretical one.

## When to Use

Applies whenever a `.svelte` file calls `gsap.to()`, `gsap.from()`, `gsap.timeline()`, or uses `ScrollTrigger`/`Draggable`/other GSAP plugins directly in a component.

Does not apply to animations defined and killed entirely within a single synchronous function call with no component-lifetime state.

## The Fix

Scope every component's GSAP work with `gsap.context()`, and revert it in `onDestroy`:

```js
import { onMount, onDestroy } from 'svelte';
import gsap from 'gsap';

let ctx;

onMount(() => {
  ctx = gsap.context(() => {
    gsap.to('.coin', { y: 20, duration: 0.5 });
    // any other tweens/timelines/ScrollTriggers created here are tracked by ctx
  });
});

onDestroy(() => {
  ctx?.revert(); // kills all tweens/timelines and ScrollTriggers created inside ctx
});
```

For a single one-off timeline instead of multiple scattered tweens, killing the timeline directly in `onDestroy` (`timeline?.kill()`) is equivalent and simpler.

## Red Flags

- `gsap.to(...)` / `gsap.timeline()` called in a component with no matching `.kill()` or `gsap.context().revert()` in `onDestroy`.
- Animations targeting elements by class/selector instead of a scoped ref — these can accidentally continue to affect elements from a *different* mounted instance of the same component.
- Long-running or infinitely-repeating tweens (`repeat: -1`) created without a cleanup path — these are the most damaging leaks since they never finish on their own.
