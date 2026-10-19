# Anew design and interaction reference

## Purpose and status

This document records the current Anew product, visual, interaction, and motion system. It is descriptive first and prescriptive second: current production code is the source of truth. Before adding or modifying screens, components, interactions, motion, or visual styles, inspect this document and the latest implementation.

Future contributors and AI coding tools should:

1. Read this document first.
2. Inspect the relevant current implementation.
3. Preserve established patterns unless a task explicitly asks for a redesign.
4. Update this document when making a deliberate system-level design change.

Status labels used here:

- **IMPLEMENTED** — present in current production code.
- **DESIGN PRINCIPLE** — a rule inferred from repeated current implementation and intended to be preserved.
- **FUTURE / UNRESOLVED** — not standardized or not implemented; not a current rule.

## Product foundation

### IMPLEMENTED

Anew is a local-first, ADHD-friendly daily planning loop. Its primary flow is:

`Pick / 选择 → Focus / 专注 → Done / 完成 → Review / 复盘`

| Stage | Current behavior |
| --- | --- |
| Pick / 选择 | Today presents one candidate task at a time. The user keeps it for today or defers it. |
| Focus / 专注 | The Focus tab surfaces one selected task, its small steps, an optional timer, and task switching. |
| Done / 完成 | Completing a selected task changes its status to `done`, clears the active timer, and gives toast or celebration feedback. |
| Review / 复盘 | The Review tab collects short reflection messages, can respond through the configured AI/mock route, and can generate tomorrow’s candidate tasks. |

Candidate tasks have `candidate` status. A kept task becomes `today`; a rejected card becomes `skippedToday`; completed selected tasks become `done`. At the next daily rollover, non-completed `today` and `skippedToday` tasks return to `candidate`; daily basics ticks, swipe count, generated-plan state, and Review messages reset.

### DESIGN PRINCIPLE

- **One decision at a time.** The candidate deck reduces simultaneous task comparison to a keep/defer decision on one card.
- **Low-pressure progress.** The interface describes small steps, optional timing, and short reflection rather than imposing a dense task dashboard.
- **Progressive disclosure.** Planning choices begin on Today; details and execution controls appear in Focus; reflection and next-day generation live in Review.
- **Mobile first.** The app is a centered, narrow mobile application rather than a responsive desktop dashboard.

## Information architecture

### Primary navigation

| Area | Purpose and main content | Primary action | Supporting states/actions |
| --- | --- | --- | --- |
| Today | Greeting, loop status, three-stage progress, Daily Basics, candidate deck, and selected plan. | Keep or defer a candidate; add a task. | Edit Daily Basics, select One Big Thing, complete a plan row, open settings. |
| Focus | One selected task, its small steps, optional focus timer, and gentle nudge. | Mark the current task complete. | Switch task; tick steps; start/pause/resume/stop timer; return to Today when nothing is selected. |
| Review | Prompt chips, stored conversation bubbles, text/voice entry, response state, and generated tomorrow preview. | Send a reflection message; generate candidates. | Remove/regenerate proposed tasks; voice input; review completion state. |

### Supporting flows — IMPLEMENTED

- **Daily Basics:** editable repeating checklist. Labels can be added, renamed, and removed; completion is per day.
- **Quick Add:** a sheet accepts a title and task type, then adds it directly to Today or to the candidate deck.
- **One Big Thing:** at most one selected task has `primary: true`; the star toggles it and clears it from other tasks.
- **Task steps:** Focus renders a task’s step list as independent check controls.
- **Focus timer:** presets of 15, 25, and 45 minutes plus Custom (5–120 minutes in 5-minute steps); it is explicitly labelled optional.
- **Settings:** six themes, English/Simplified Chinese switch, local data summary, JSON export/import, and reset.
- **AI plan:** Review can call `/api/ai-plan`; resulting canonical tasks are mirrored into tomorrow’s candidate deck.
- **Review chat:** Review can call `/api/review-chat`; user and assistant messages appear as distinct bubbles.
- **Voice input:** available from the Review composer only when browser speech recognition is available.

## Visual direction

### IMPLEMENTED

The application uses a narrow mobile shell over theme-controlled vertical gradients. Main surfaces are translucent white “glass” cards/pills with backdrop blur, soft low-contrast borders, rounded corners, and negative-offset shadows. Accent color is thematic, while base ink colors remain stable.

Cards and controls give task content priority: typography is compact, decoration is limited to status dots, type badges, progress, simple inline SVG icons, and completion feedback.

### DESIGN PRINCIPLE

Future work should preserve low visual density, a dominant immediate task/decision, restrained decoration, and soft state feedback. Avoid dashboard-like grids of equal-priority controls, strong opaque shadows, arbitrary new gradients, or decoration that competes with task content.

## Color system

### Global tokens — IMPLEMENTED

| Documentation label | Exact value | Code token / current use |
| --- | --- | --- |
| Global page background | `#e5e8ec` | `--background` in `app/globals.css`; default document background. |
| Global foreground | `#1e2127` | `--foreground`; app `--ink` uses `#1E2127`. |
| Primary ink | `#1E2127` | `--ink`; headings and primary task text. |
| Secondary ink | `#565C66` | `--ink2`; supporting text. |
| Muted ink | `#959AA4` | `--ink3`; labels, metadata, inactive navigation. |
| Input placeholder | `#ABAC9F` | Inputs. |
| Standard white surface | `#fff` / translucent white | Inputs, cards, controls; glass variants below. |
| Glass card | `rgba(255,255,255,0.46)` | `.glass-card`; border `rgba(255,255,255,0.6)`, blur 26px, saturation 1.4. |
| Glass pill | `rgba(255,255,255,0.5)` | `.glass-pill`; border `rgba(255,255,255,0.62)`, blur 18px, saturation 1.3. |
| Overlay | `rgba(20,24,32,0.34)` | Sheet scrim. |
| Completion overlay | `rgba(243,246,250,0.93)` | Full-screen completion state. |
| Destructive text | `#9A625C` | Reset action. |
| Destructive surface | `#F5E2DD` / `#8C493F` | Import error surface/text. |

### Task type colors — IMPLEMENTED

| Type | Text/dot | Badge background |
| --- | --- | --- |
| Focus | `#BE5E37` | `#F4E4DA` |
| Quick | `#4E8AA8` | `#E1EEF4` |
| Errand | `#5C6657` | `#E8EBE2` |
| Health | `#3E9B8B` | `#DFF0EC` |
| Admin | `#8A8E84` | `#ECEDE8` |
| Life | `#C29A3A` | `#F6EED8` |

### Themes — IMPLEMENTED

Themes change gradient page background, gradient button background, solid accent, soft surface/border, completion colors, and navigation tint/border. Ink tokens do not change.

| Theme | Background | Button | Solid accent | Soft surface / border | Done: bg, label, check |
| --- | --- | --- | --- | --- | --- |
| Daybreak | `#E2ECF8 → #EFEAE8 → #FBEEDE` | `#84A4E8 → #F0A88E` | `#C76A56` | `#F4E7DC` / `rgba(176,108,80,.18)` | `#F6E7DD`, `#A85138`, `#C76A56` |
| Tide | `#DEEDF0 → #ECEDE6 → #F8EFE2` | `#64BFAD → #DDB969` | `#5E9277` | `#E7EEE9` / `rgba(70,120,100,.18)` | `#E3F0E7`, `#3E7A56`, `#5AA075` |
| Glacier | `#DCEEF7 → #E8F1F2 → #F4EEE4` | `#5B9FC8 → #79C7B7` | `#397FA5` | `#E1EFF4` / `rgba(57,127,165,.20)` | `#DDEEF2`, `#2E6E8E`, `#397FA5` |
| Sakura | `#F5E3EA → #F3E9E7 → #F7F0DE` | `#D47E9B → #E3AC76` | `#B95F80` | `#F5E6EC` / `rgba(185,95,128,.19)` | `#F3E2E9`, `#984766`, `#B95F80` |
| Sunset | `#F7E4D5 → #F3E5E1 → #E9E5F4` | `#E18B62 → #9B82CE` | `#C16B50` | `#F6E7DE` / `rgba(193,107,80,.20)` | `#F5E3DA`, `#9F513B`, `#C16B50` |
| Stone | `#E5E8EA → #ECEAE5 → #F3E9DE` | `#748894 → #B78D72` | `#657985` | `#E8ECEE` / `rgba(101,121,133,.20)` | `#E4EAEC`, `#506570`, `#657985` |

Navigation backgrounds and borders are defined per theme in `THEMES`; use those existing values rather than introducing theme-specific colors ad hoc.

## Typography

### IMPLEMENTED

| Role | Family / size / weight / tracking | Current use |
| --- | --- | --- |
| Sans base | `"Avenir Next", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif` | Body and `font-sans`. Chinese falls through to PingFang SC on Apple platforms or Microsoft YaHei UI/YaHei on Windows where available. |
| Mono base | `"Cascadia Code", "SFMono-Regular", Consolas, monospace` | `font-mono`; compact metadata, English labels, timer/numeric values. |
| Page title | Sans, 31px, bold, line-height 1.05, tracking -0.02em | Today greeting; Focus/Review titles. |
| Section label | English: mono, uppercase, 10.5px, usually tracking .16em. Chinese: sans, 10.5px, tracking .04em, no uppercase. | `MonoLabel`. |
| Type badge | Same locale rule, 10px; English tracking .12em | Type classification. |
| Body/supporting text | Sans, mostly 12.5–14.5px; frequent light weight and 1.45–1.55 line-height | Reasons, helper copy, Review intro. |
| Task title | Sans semibold; candidate 26px; Focus 27px; Today plan 15.5px or 18px for primary | Task hierarchy. |
| Buttons | Sans medium/semibold, mostly 13–15.5px | Actions. |
| Navigation labels | English mono uppercase tracking .14em; Chinese sans tracking normal; 9.5px | Bottom navigation. |
| Timer | Mono, 44px, weight 500, tracking .04em | Active timer display. |
| Review bubbles | Sans, 14px, line-height 1.45 | User/assistant chat. |

### DESIGN PRINCIPLE

Chinese UI labels should not inherit English mono uppercase treatment or wide English tracking. Existing localized labels use `font-sans` with `tracking-[0.04em]`; the three Chinese navigation labels use `tracking-normal`. Numeric values may remain mono.

### FUTURE / UNRESOLVED

There is no centralized semantic type-scale token layer; type styles are currently expressed through Tailwind classes and occasional inline styles.

## Spacing, layout, and responsive behavior

### IMPLEMENTED

- Root app: `min-h-dvh`; app content is centered at `width: 100%`, `max-width: 430px`.
- Primary page horizontal padding: 22px. Today top padding: 56px (`pt-14`). Focus and Review top padding: 48px (`pt-12`).
- Today header uses a 9px internal gap; status pill follows at 16px; supporting prompt at 20px; stage progress at 18px.
- Section spacing commonly uses 14px, 18px, 20px, 22px, 24px, 26px, or 28px rather than a formal uniform scale.
- Main cards commonly use 20px, 22px, or 26px radii. Sheet top radius is 28px.
- Page bottom spacers: Today/Focus 130px; Review 210px, reserving room for fixed navigation and the Review composer.
- Bottom navigation: fixed, centered, full available width up to 430px; 14px horizontal padding; 11px top padding; bottom padding `max(12px, env(safe-area-inset-bottom))`.
- Review composer: fixed 106px above viewport bottom, `max-width: 402px`, width `calc(100% - 28px)`.
- Sheet: fixed at bottom, up to 430px wide and `max-height: 88dvh`, with vertical scrolling.
- Horizontal Daily Basics list hides scrollbars (`.ts-scroll`) but remains horizontally scrollable.
- Layout has no explicit tablet/desktop breakpoint or alternate desktop composition. Larger viewports retain the centered 430px mobile shell.
- `viewportFit: "cover"` is set. The only safe-area CSS use in the app shell is the bottom navigation’s bottom padding.

### DESIGN PRINCIPLE

Use the existing centered, phone-width composition as the reference layout. Keep fixed bottom UI clear of content using the established page bottom spacers; do not add fixed controls without revisiting this clearance.

### FUTURE / UNRESOLVED

There is no formal spacing token system, desktop layout specification, or documented tablet behavior beyond the current mobile shell constraint.

## Component inventory

| Pattern | Current structure and states | Usage constraint |
| --- | --- | --- |
| Candidate swipe card | Glass card, type badge, duration, title, reason, Keep/Not today actions; a second visual card sits behind when deck has more than one item. | One candidate at a time. |
| Today plan row | Glass card with task-type dot, title, type/duration metadata, One Big Thing star, completion control. Primary variant has larger type and accent border. | Keep a single `primary` task maximum. |
| Focus card | Glass card with type, duration, primary indicator, task title, and tappable steps. | Present one current selected task at a time. |
| Buttons | Gradient accent primary buttons; soft-surface secondary buttons; transparent/destructive variants; icon circles. | Main task decision gets the stronger visual treatment. |
| Daily Basic pill | White/complete-state pill with 18px circular check. | Horizontally scrollable collection. |
| Type badge | Colored 10px pill derived from `TYPE_COLORS`. | Uses current task type only. |
| Sheet | Dim scrim and bottom panel with handle, glass-adjacent pale surface, 28px top corners. | Used for Quick Add and Settings. Scrim click closes. |
| Input | White, 14–17px radius, light border, muted placeholder. | Quick Add, editable Daily Basics, Review composer. |
| Timer | Optional focus support: preset controls, custom +/- controls, large mono countdown and progress bar. | Secondary to the Focus task. |
| Review message | Right-aligned glass user bubble; left-aligned soft assistant bubble; max-width 84%. | Assistant response is text-only. |
| Feedback | Fixed toast; full-page celebration overlay; loading dots; disabled generation actions via opacity. | Feedback is brief and state-linked. |
| Error pages | Centered glass card/page with retry button. | Error UI currently remains English. |

## Task card system

### IMPLEMENTED

| State | Visible information and actions |
| --- | --- |
| Candidate | Type badge, estimated minutes, title, reason, drag feedback, and Not today/Keep today buttons. Energy is present in task data but not rendered on current cards. |
| Today | Title, type, minutes, type dot, optional primary star, and complete control. |
| Focus | Type badge, minutes, optional primary label, title, small steps, optional timer, and Mark complete action. |
| Completed | In Today plan, title becomes muted and struck through; completion control uses accent background. |
| Skipped | Not separately rendered. It is absent from the current deck/plan until the next daily rollover returns it to candidates. |

Information priority is title first, then task type/minutes and contextual reason where relevant. Energy values are retained in data/API schemas but are not a current user-visible card attribute.

## Swipe interaction system

### IMPLEMENTED

- Candidate tasks are shown one at a time: `deck[0]`.
- Candidate card events use React Pointer Events, covering pointer-capable mouse and touch input.
- Card CSS uses `touch-pan-y`, so vertical page scroll remains the browser’s intended gesture.
- On pointer down, a gesture begins only if the event target is not inside a `button`; pointer capture is deliberately deferred.
- Axis decision threshold: **10px** (`AXIS_LOCK`). Before that, neither drag nor capture begins. If vertical travel is larger than horizontal travel, the gesture is abandoned for page scrolling. Otherwise the gesture locks horizontally and captures the pointer.
- Acceptance threshold: **90px** horizontal travel (`SWIPE_THRESHOLD`) on pointer up.
- Right (`dx > 90`): `swipe(true)`; current candidate becomes `today`.
- Left (`dx < -90`): `swipe(false)`; current candidate becomes `skippedToday`.
- A horizontal release below the threshold resets drag state, letting the normal transform transition return the card to center.
- Visible/tappable alternatives are always present: **Not today** and **Keep today** call the same swipe function.
- Drag transform: `translateX(dx)` plus `rotate(dx * 0.04deg)`. Keep/Skip feedback fades from 0 to 1 as horizontal drag approaches 90px.
- Accepted/rejected exit: `translateX(±430px) rotate(±7deg)`, opacity 0, `transform 0.3s ease, opacity 0.3s ease`.
- After 290ms, the status updates; the next card is marked entering and fades in with `opacity 0.25s ease`. Entering state ends after 260ms.
- Normal non-drag snap-back: `transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease`.

### DESIGN PRINCIPLE

Gestures must preserve vertical scrolling and retain visible tap controls as alternatives. Swipe feedback should explain a committed decision, not act as decoration.

## Focus experience

### IMPLEMENTED

Focus is entered with a selected (`today`) task; the first primary task is ordered first. With no selected task, the Focus tab shows an empty state and a return-to-Today action. With a task, it presents its small steps, optional timer, task switch control when more than one task is pending, and Mark complete.

After 300 seconds of active Focus eligibility, a gentle nudge appears. The user can continue (hides this nudge for the current Focus session) or switch task. Completing from Focus stops the timer and displays the 1.6-second completion overlay.

### DESIGN PRINCIPLE

Task execution is visually primary; steps and timer are supporting controls rather than competing destinations.

## Review experience

### IMPLEMENTED

Review always has prompt chips, message history, a fixed input bar, send control, and browser speech input control. The client renders its user message immediately, shows three bouncing dots while awaiting a reply, then adds an assistant bubble. On route failure, it adds a fixed fallback reply.

After at least one user message, the UI offers task generation. The generated-plan panel lists proposed task titles, type-color dots, minutes, remove controls, regenerate control, and an empty state. Generated tasks are candidates, not automatically selected Today tasks.

Review messages are persisted inside current loop state and reset at daily rollover. There is no implemented cross-day Review archive UI.

## Motion inventory

### IMPLEMENTED

| Motion | Trigger / property | Exact timing / easing | Purpose |
| --- | --- | --- | --- |
| Page/tab entry | `animate-ts-fade`, opacity | 0.25s ease | Current tab appears. |
| Generic rising content | `animate-ts-rise`, translateY(20px) + opacity | 0.28s cubic-bezier(0.22,1,0.36,1) | Sheets, chat bubbles, generated panels, toasts, nudges. |
| Completion icon | `animate-ts-pop`, scale .55→1.07→1 + opacity | 0.5s cubic-bezier(0.22,1,0.36,1) | Completion acknowledgement. |
| Swipe drag | transform follows pointer; no transition while active | immediate | Direct manipulation. |
| Swipe release | transform/opacity | 0.25s cubic-bezier(0.22,1,0.36,1) snap-back; 0.3s ease exit; 0.25s ease next-card opacity | Decision continuity. |
| Drag feedback / status bars | color/opacity transitions | 300ms color on status; opacity derives from drag distance | Shows swipe meaning and loop progress. |
| Plan/basics/task controls | color/visual transition | commonly 150ms or 200ms | Selected, completed, or state changes. |
| Timer progress | width | 1000ms linear | Mirrors second-by-second countdown. |
| Reply loading | three `animate-bounce` dots, staggered -0.3s/-0.15s | Tailwind bounce defaults | Waiting feedback. |
| Voice control | pulse while listening | Tailwind pulse default | Listening state. |

### DESIGN PRINCIPLE

Motion is functional: it signals a decision, entry, completion, waiting, or a continuously changing timer. Avoid long blocking animation, parallax, gratuitous bounce, or motion that delays direct manipulation.

### FUTURE / UNRESOLVED

No `prefers-reduced-motion` handling or centralized motion-token layer is present.

## Iconography, borders, radii, and shadows

### IMPLEMENTED

- Icons are inline SVGs and simple glyphs; no icon-library dependency exists.
- SVGs use currentColor or direct fills; common stroke widths are 1.8–2.4. Navigation icons use a 22×22 viewBox and render at 21px; settings SVG is 13px; voice SVG 15px.
- Icon-only controls include settings, quick add, voice, send, remove, step/timer controls, stars, checks, and navigation.
- Repeated radii: 14–19px for inputs/small controls; 20px for plan/chat cards; 22px composer; 26px principal cards; 28px sheets/error card; full circles for icon/check controls and pills.
- Borders are mainly 1px semi-transparent dark or white; primary plan border is 1.5px accent when marked primary.
- Repeated shadows use muted blue-gray/ink black at large blur with negative spread, e.g. candidate card `0 22px 40px -24px rgba(42,50,68,.45)`.

### FUTURE / UNRESOLVED

Radius and shadow values are repeated but not centralized into tokens. Treat consolidation as a deliberate design-system change, not an implicit rule.

## State system and accessibility

### IMPLEMENTED

- **Default/selected/completed:** task, basic, timer-preset, language, and theme controls have distinct color/border states.
- **Disabled:** plan-generation actions apply `disabled:opacity-60`; interactive handlers also prevent duplicate in-flight generation.
- **Loading:** Review uses bouncing dots; generate/regenerate labels switch to generating states.
- **Empty:** Focus explains no task is selected; Daily Basics and generated plan have empty copy; deck completion renders the loop ring.
- **Error:** import error is shown inline; page/global errors expose retry; API routes fall back to mock/server responses.
- **Dragging:** swipe card receives direct transform, Keep/Skip overlays, and a grabbing cursor while active.
- **Semantics:** interactive controls are native `button`s. Icon buttons commonly receive `title` and/or `aria-label`; primary stateful controls include `aria-pressed` where used. Voice listening has an `aria-live` status.
- **Gesture alternative:** all swipe actions have buttons.
- **Touch target evidence:** many controls are 34–54px; settings is 26×26px and remove generated task is 22×22px, so a universal 44px minimum is not implemented.
- **Language:** initial document language is English; client updates `document.documentElement.lang` to the selected locale.

### FUTURE / UNRESOLVED

No verified WCAG conformance, focus-visible styling system, full keyboard-flow audit, semantic dialog behavior/focus trap, or reduced-motion support is implemented. Do not claim these as current guarantees.

## Localization and theming

### IMPLEMENTED

- Supported UI locales: English (`en`) and Simplified Chinese (`zh-CN`), via `app/lib/i18n.ts`.
- Language selection is in Settings and persists in loop state/local storage.
- Locale priority: a saved valid locale wins; otherwise `NEXT_PUBLIC_DEFAULT_LOCALE` is used if valid; otherwise English.
- Current deployment defaults: a Vercel build without the public locale environment variable first loads **English**; the provided Dockerfile defaults `NEXT_PUBLIC_DEFAULT_LOCALE` to **Simplified Chinese**, which is the CloudBase-oriented container default. A saved choice has highest priority.
- Current code adjusts many localizable micro-labels to sans/reduced tracking in Chinese. Some dynamic/fallback strings remain English in component logic; they are an implementation inconsistency, not a documented bilingual rule.
- All six theme choices are translated through `themeMeta` and persist with the rest of loop state.

### DESIGN PRINCIPLE

Check both locales when adding fixed-width controls or compact labels. Prefer flexible layout and the established locale-aware mono utility for textual labels.

## Content and microcopy

### DESIGN PRINCIPLE

- Favor concise, task-oriented verbs: keep, defer, complete, switch, send, reset.
- Use non-punitive, low-pressure supporting language: timer is optional, one line is enough, and a nudge offers continuation or switching.
- Keep destructive wording explicit: import overwrites local data; reset clears it.
- Preserve existing capitalization and punctuation per locale rather than adding title-case or all-caps UI indiscriminately.

## Practical design do / don’t

### DO

- Keep one task or decision visually dominant.
- Reuse existing theme values, card patterns, typography hierarchy, and spacing values.
- Preserve vertical scrolling during horizontal interactions.
- Provide visible tap controls for any gesture.
- Test English and Simplified Chinese, all six themes, and phone-width layout.
- Define loading, empty, and error behavior for new asynchronous UI.

### DON’T

- Turn Today into a dense dashboard or add multiple equal-priority primary CTAs.
- Add colors, radii, shadows, gradients, or motion without a current-system counterpart.
- Make an action gesture-only.
- Treat unimplemented accessibility features or desktop/tablet behavior as established.
- Surface data-model fields solely because they exist; energy is an example of an internal field that is currently not displayed.

## Future screen/component checklist

- What single user decision or action is primary?
- Does the change increase decision density?
- Can an existing card, sheet, button, badge, or feedback pattern solve it?
- Does it work within the 430px mobile shell and fixed-bottom clearance?
- Does it work in English and Simplified Chinese, including locale-aware label typography?
- Does it remain semantically consistent across all six themes?
- Does it preserve vertical scrolling and offer a visible alternative for every gesture?
- Does motion explain a state transition and remain short?
- Are default, loading, empty, success, error, selected, and disabled states defined where relevant?
- Are native controls, accessible labels, and keyboard/touch implications considered?

## Future / unresolved design work

| Area | Current situation | Decision needed before implementation |
| --- | --- | --- |
| Formal tokens | Colors/themes are structured; spacing, type, radius, shadow, and motion values are mostly local classes. | Decide whether and how to centralize without changing visual output. |
| Accessibility audit | Some native buttons/labels and gesture alternatives exist; no full audit or reduced-motion support. | Define target standards and test plan. |
| Tablet/desktop | No alternate composition; app remains max 430px centered. | Define intended large-screen behavior before adapting layout. |
| Component primitives | Repeated patterns exist inside one main component rather than a formal component library. | Decide component boundaries only when reuse warrants it. |
| Bilingual fallback copy | Localization exists, but some component-level fallback/toast strings remain English. | Audit and define completion criteria for bilingual dynamic copy. |
| Review history | Daily messages persist in loop state but reset at rollover; no archive interface. | Define retention and retrieval expectations. |
| AI state UX | Real providers, mock fallback, and fallback responses exist. | Decide whether source/status/errors should be surfaced differently to users. |
| Offline/PWA behavior | Manifest and mobile-web metadata exist; no service worker/offline strategy is present. | Define offline expectations before calling the app install/offline complete. |

## Source-of-truth map

| System | Current source |
| --- | --- |
| Product shell, UI, interaction, component patterns | `app/components/loop-app.tsx` |
| Global visual styles, fonts, glass surfaces, keyframes | `app/globals.css` |
| Locale dictionaries, locale resolution, review prompts | `app/lib/i18n.ts` |
| Display task model, themes, type colors, seed content | `app/lib/loop-data.ts` |
| Canonical data model | `lib/types.ts` |
| Local storage, export/import, legacy compatibility | `lib/storage.ts` |
| Browser speech input | `app/hooks/use-speech-recognition.ts` |
| AI task planning | `app/api/ai-plan/route.ts` |
| Review conversation | `app/api/review-chat/route.ts` |
| Metadata and mobile viewport | `app/layout.tsx` |
| Manifest and app-install metadata | `app/manifest.ts` |
| Next.js headers/runtime configuration | `next.config.ts` |
