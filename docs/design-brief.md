# Anew Design Brief

This brief describes the current product direction for Anew: a calm, mobile-first daily planning app for people who benefit from a simpler, more forgiving planning loop.

## One-sentence positioning

Anew helps you pick one small thing, focus on it, finish it, and reflect — one gentle loop a day.

## Intended feeling

- Calm rather than urgent.
- Supportive rather than corrective.
- Focused rather than dense.
- Lightweight rather than productivity-maximalist.
- Mobile-first, thumb-friendly, and easy to resume.

## Core loop

**Pick → Focus → Done → Review**

The interface should make the current step obvious without making the user feel behind.

## Information architecture

### Today

- Date and greeting.
- Daily progress indicator.
- Daily basics checklist.
- Swipe planner with one candidate task at a time.
- Today's plan with one big thing and smaller supporting tasks.
- Completion state that gently leads to Review.

### Focus

- One current task.
- Small steps.
- Optional timer.
- Gentle nudge when the user has been on the same task for a while.
- Clear completion action.

### Review

- Short reflection prompts.
- Chat-style input, including supported browser voice input.
- Friendly response.
- Option to generate tomorrow's candidates.

## Visual direction

- Soft gradients and frosted glass cards.
- Generous radius and spacing.
- Muted text for utility actions.
- Strong but calm primary actions.
- Monospace labels are useful for English metadata, but Chinese UI should use a natural sans-serif rhythm where appropriate.

## Interaction principles

- Swipe gestures should feel direct and predictable.
- Vertical scrolling must not be hijacked by horizontal card gestures.
- Buttons should mirror gesture actions.
- Completion feedback should be satisfying but not noisy.
- Destructive actions should be explicit and reversible where practical.

## Content principles

- Use plain, supportive language.
- Avoid shame, streak pressure, and urgent warnings.
- Avoid over-explaining.
- Prefer small next actions over abstract productivity language.

## Technical constraints

- Next.js app, mobile-first web UI.
- Local-first storage with export/import.
- AI is optional and server-side.
- PWA metadata should remain install-friendly.
- The public demo should work safely in mock mode.
