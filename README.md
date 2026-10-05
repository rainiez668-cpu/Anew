# Anew

**English | [简体中文](README.zh-CN.md)**

> **One small loop a day.**

Anew is a mobile-first, ADHD-friendly daily planning app designed to reduce the decisions required to start one thing.

Instead of asking you to compare a long list of tasks at once, Anew presents **one candidate task at a time** and turns planning into a series of simple decisions: **Not today** or **Keep today**. By narrowing the choice in front of you, the swipe-based interaction reduces comparison and makes it easier to move from planning to action.

**Pick → Focus → Done → Review**

---

## Why Anew

Traditional to-do lists often present everything at once. Before starting, you may already need to compare priorities, estimate effort, and decide what deserves attention.

Anew explores a simpler question:

> **How might we reduce the decisions required to start one thing?**

Rather than adding more planning controls, Anew narrows the experience into a sequence of small decisions and a lightweight daily loop.

## Core Interaction

### Swipe to decide

Candidate tasks are presented **one at a time**.

- **Swipe left** or tap **Not today** to skip a task for the day.
- **Swipe right** or tap **Keep today** to add it to today's plan.

Skipped tasks leave the current day's deck and return as candidates on the next daily rollover.

The interaction turns a multi-option planning problem into a sequence of simple binary decisions.

## The Daily Loop

### Pick

Choose today's tasks through the swipe deck, or quickly add a task yourself.

One task can be marked as your **One Big Thing**.

### Focus

Work on one selected task at a time.

Focus includes:

- checkable task steps
- task switching
- optional countdown timer
- 15 / 25 / 45 minute presets
- custom timer duration
- a gentle focus nudge during longer sessions

### Done

Complete tasks directly from Today or Focus and keep track of the day's progress.

### Review

Reflect on the day through a conversational Review.

Your reflection can be used to generate new candidate tasks for the next planning cycle.

Where supported by the browser, Review also supports voice input.

## Features

- One-at-a-time swipe planning
- **Keep today / Not today** task decisions
- Today plan and completion tracking
- **One Big Thing** prioritization
- Quick Add
- Editable Daily Basics
- Checkable task steps
- Optional Focus timer
- Conversational daily Review
- AI-assisted candidate task generation
- Browser-based voice input where supported
- English and Simplified Chinese interface support
- Six visual themes
- Local browser persistence
- JSON export, import, and reset
- Add-to-home-screen metadata for a mobile app-like experience

## Design Principles

**One decision at a time**  
Reduce comparison instead of adding more prioritization controls.

**Momentum over exhaustive planning**  
Help the user begin and continue rather than build the perfect task system.

**Optional structure**  
Timers, task steps, Daily Basics, and AI assistance are available when useful rather than required for every task.

**Calm, mobile-first interaction**  
The experience is designed around a focused mobile flow rather than a dense productivity dashboard.

**Local-first personal data**  
Core planning data stays in the user's browser unless they explicitly export it or send Review context to a configured AI provider.

## Built With

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Browser `localStorage`
- Next.js API Routes
- Mock / OpenAI / Anthropic AI provider adapters
- Web Speech Recognition where supported
- Vitest
- GitHub Actions

## AI

Anew includes two server-side AI flows:

- **Review conversation** — responds to the user's daily reflection
- **Candidate generation** — uses Review and current planning context to suggest new candidate tasks

The application supports `mock`, OpenAI, and Anthropic providers.

`mock` works without an API key. OpenAI and Anthropic integrations require your own provider credentials.

Provider keys are read only by server-side API routes and should never be exposed to the browser.

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

For local use without a real AI provider:

```env
AI_PROVIDER=mock
```

Then open:

```text
http://localhost:3000
```

For testing on another device on the same local network:

```bash
npm run dev:lan
```


## Current Limitations

Anew is currently a local-first MVP.

- Data is stored per browser and per device.
- Accounts and authentication are not implemented.
- Cross-device or cloud synchronization is not implemented.
- Review does not currently provide a long-term historical archive.
- Some runtime-generated content is not yet fully localized in Simplified Chinese.
- Voice input depends on browser support.
- Add-to-home-screen metadata is implemented, but offline service-worker support is not.
- Full AI functionality requires a Next.js-capable deployment environment.

## Security

API credentials must remain server-side. Never commit `.env.local` or expose provider keys through `NEXT_PUBLIC_` environment variables.

See [`SECURITY.md`](SECURITY.md) for credential-handling and security guidance.
