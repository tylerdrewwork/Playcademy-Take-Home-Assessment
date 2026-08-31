---
name: superpowers-ask-first
description: Use BEFORE invoking any superpower (plugin) skill in any agent — the user must be asked for permission first. One ask per agent; the answer covers all superpower skills for the rest of that agent.
---

# Superpowers: Ask First

## Overview

Superpower (plugin) skills must never be invoked without the user's permission. Before the first superpower skill would be used in an agent, that agent must ask the user whether superpower skills may be used. The answer then applies to the whole rest of that agent:

- **Allowed:** superpower skills may be used freely for the rest of that agent — no need to ask again.
- **Denied:** no superpower skills may be used for the rest of that agent. Accomplish the task without them; do not re-ask or work around the denial.

## Scope

- "Superpower skills" means any skill provided by the superpowers plugin (skills listed with a plugin prefix such as `superpowers:<skill>`, or otherwise identifiable as coming from that plugin).
- Permission is **per agent**, not per project or per conversation. The main session and each subagent each count as their own agent: a subagent may not inherit the main session's answer, and vice versa. Each agent that would use a superpower skill must obtain its own answer first.
- Permission lasts only for the lifetime of that agent. A new session or a new subagent starts with no permission and must ask again.

## How to Ask

Ask before the first superpower skill invocation, not after. Use AskUserQuestion when available; otherwise ask in plain text and wait for the reply. The ask should name what you want to do, e.g.:

> This task would benefit from superpower plugin skills (e.g. `superpowers:<skill>`). May I use superpower skills for the rest of this agent?

If the agent cannot reach the user (e.g. a subagent with no way to ask), treat that as **denied** — do not use superpower skills.

## Red Flags

- Invoking a `superpowers:*` skill with no prior ask in the current agent.
- A subagent using superpower skills because the main session was allowed to — permission does not transfer between agents.
- Re-asking after a denial, or using a superpower skill "just partially" after being denied.
