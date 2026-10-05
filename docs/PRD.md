# Anew Product Requirements

## Product summary

Anew is a mobile-first, ADHD-friendly daily planning app. It helps a person turn a day into one gentle loop:

**Pick → Focus → Done → Review**

The app intentionally avoids the feeling of a dense task manager. It presents one candidate task at a time, encourages a small daily plan, supports one-task focus, and closes the day with a short reflection that can seed tomorrow's candidates.

## Target users

- Adults who experience ADHD traits, distractibility, decision fatigue, or task overwhelm.
- People who find traditional to-do lists too dense or guilt-inducing.
- Mobile-first users who want a lightweight daily planning ritual.

## Core information architecture

- **Today:** daily overview, basics, swipe planner, and today's plan.
- **Focus:** one current task, small steps, optional focus timer, gentle re-entry nudge.
- **Review:** short reflection, optional voice input, and AI-assisted tomorrow planning.

## Core interaction

The morning planner uses a swipe-card model:

- One task candidate is shown at a time.
- Left swipe means **Not today**.
- Right swipe means **Keep today**.
- Buttons provide the same actions for accessibility and clarity.

## Product principles

1. Show one thing at a time.
2. Reduce decision fatigue.
3. Keep the tone gentle and non-punitive.
4. Make the first step obvious.
5. Support time blindness with estimates, optional timer, and gentle nudges.
6. Make completion feel satisfying without becoming noisy.
7. Keep data local-first and portable.

## MVP scope

### Included

- Today / Focus / Review tabs.
- Swipe-based daily task selection.
- Daily basics that reset each day.
- One big thing plus smaller supporting tasks.
- Optional focus timer.
- Review conversation and AI-generated tomorrow candidates.
- Mock / OpenAI / Anthropic provider adapter.
- English and Simplified Chinese UI.
- Local JSON export / import / reset.
- PWA manifest and install-friendly metadata.

### Not included yet

- Accounts.
- Cloud sync.
- Team or collaboration features.
- Push notifications.
- Calendar integration.

## Data and compatibility

Anew stores data locally in the browser. The implementation keeps backward compatibility with legacy storage keys and legacy export files so existing browser data and backups can still be imported. Public copy should describe this generically as legacy data compatibility rather than naming earlier product identities.

## Success criteria

- A user can open the app, choose tasks for today, complete at least one task, and close the day with a review.
- The app works in mock mode without provider keys.
- Self-hosters can enable real AI by adding their own server-side provider keys.
- Export / import continues to support current and legacy backup files.
- The UI stays mobile-first, calm, and simple.
