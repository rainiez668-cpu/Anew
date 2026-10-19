# Anew Roadmap

Anew is a mobile-first daily planning app for people who experience task-initiation difficulty. This roadmap preserves the calm core loop — **Pick → Focus → Done → Review** — while gradually improving planning, focus, and reflection.

> Aligned with [PRD v2.0](./PRD.md). Status items reflect the current codebase, not aspiration.

## Guiding principles

- Keep the daily loop small: **Pick → Focus → Done → Review**.
- Prefer fewer choices over more controls.
- Keep skipped or unfinished tasks shame-free.
- Preserve local-first behavior and data portability.
- Make AI helpful but optional.

## Current status

- Today / Focus / Review information architecture — MVP.
- Swipe-based progressive task selection with equivalent buttons for keyboard & accessibility.
- Daily Basics — persistent checklist, per-day checkmark resets at rollover.
- One Big Thing — single primary task, unique-slot constraint enforced in code.
- Optional focus timer — 15 / 25 / 45 min presets + custom duration; off by default.
- Conversational Review — public demo uses mock AI replies.
- AI provider adapters — Mock / OpenAI / Anthropic, server-side keys only.
- Bilingual UI — English / Simplified Chinese; runtime content partially localized.
- Local JSON export / import / reset with legacy data compatibility.
- Six visual themes — contrast and cross-theme consistency still need refinement.
- Install-ready manifest metadata — not a full offline PWA.
- Usability testing — 5 participants, findings and priorities recorded (see PRD §09).

## Near-term

- First-run onboarding that is short and skippable.
- Improve gesture discoverability and skipped-task state feedback.
- Clarify One Big Thing and Daily Basics labeling.
- Adjust Quick Add default-steps logic — let users add, edit, or skip steps freely.
- Complete empty states, transitions, and edge-case feedback.
- Finish Simplified Chinese localization of runtime content.
- Theme consistency and text contrast (WCAG AA targets).
- Keyboard, screen-reader, and `prefers-reduced-motion` support.
- Label the public AI demo as mock replies.

## Mid-term

- Configure and validate real AI model services (deployment, error handling, Chinese I/O).
- AI-assisted task breakdown — turn large tasks into actions that can start within five minutes; users can edit or adopt generated steps freely.
- No-shame weekly momentum review — show what was accomplished, not streak breaks.
- Backup / restore experience improvements.
- Offline resilience and install experience.

## Long-term

- Larger user testing and comparison against traditional task lists.
- Privacy-preserving anonymous research data (local statistics + user-submitted summaries).
- Evaluate accounts and sync only after real usage demand is evidenced.

## Out of scope (by design)

- Multi-user collaboration and task sharing.
- Complex long-term project management.
- Streaks, penalty systems, and completion-rate dashboards.
- Default push notifications.
- Calendar scheduling / time-blocking.