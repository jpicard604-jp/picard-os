# Skill: XODUS UI & Dashboard Architecture

**When to use:** Any task touching dashboard components, design tokens, the reactive event pattern, bottom nav, or XODUS visual output.

## Dashboard Composition (`app/page.tsx`)

```
GreetingHeader → CommandCenter → QuickActions → WhatNeedsAttention
→ XodusCard → DailyGoals → QuickCapture → TodayTimeline
→ QuickStats → FitnessWidget → ActivityOverview → ProjectSummary → StackPreview
```

All dashboard cards live in `components/dashboard/`. Each is `'use client'` and manages its own data refresh.

## Reactive Component Pattern (canonical: `XodusCard.tsx`)

```tsx
'use client'
const EMPTY = computeWithEmptyInputs()     // stable, SSR-safe initializer
const [data, setData] = useState(EMPTY)

useEffect(() => {
  function refresh() { setData(loadRealData()) }
  refresh()
  window.addEventListener('picard:daily-log-updated', refresh)
  return () => window.removeEventListener('picard:daily-log-updated', refresh)
}, [])
```

Never seed `useState` from a localStorage-reading function directly — always use an empty constant + `useEffect`.

## Design Tokens

| Token | Value | Use |
|-------|-------|-----|
| Page bg | `bg-[#0a0a0a]` | Root layout |
| Card bg | `bg-[#111]` | Standard card |
| Inset bg | `bg-[#0f0f0f]` | Nested elements |
| Border | `border border-white/10` | Standard |
| Subtle border | `border border-white/[0.07]` | Quiet dividers |
| Card utility | `card-elevated` | Defined in `globals.css` |
| Label pattern | `text-[9px] font-mono uppercase tracking-widest text-zinc-600` | Metric labels |
| Data value | `text-lg font-mono font-bold text-white` | Numbers/metrics |

## Glow Utilities (defined in `globals.css`)

`glow-green`, `glow-blue`, `glow-amber`, `glow-red`

## Bottom Nav (`components/BottomNav.tsx`)

5 items in `NAV_ITEMS` array: Home | XODUS | Daily | Projects | Stack.
`/fitness` is NOT in the nav — linked from FitnessWidget. Add new items to `NAV_ITEMS` only.

## XODUS Output Rendering

XODUS brief is assembled by `generateXodusOutput()` in `lib/xodus-message.ts` and rendered in `XodusCard.tsx` and `/xodus` page as an array of prose paragraphs. Never hard-code paragraph text — always derive from `DailyLog` + `DailyStatusExtras`.

## Visual Rules

- Icons: Lucide React only. Never heroicons or other libraries.
- No gradients on backgrounds — only on ring/progress fills.
- Glassmorphism (`backdrop-blur`) only in top nav and drawer overlays.
- Motion: 150–200ms ease-out. No decorative animations.
- Touch targets: minimum 44×44px.
- No horizontal scroll at any screen width.

## What NOT to do

- Never import `JACKSON` mock data into new dashboard components — use real storage functions with null guards.
- Never use hover-only interactions (mobile-first).
- Never add to the bottom nav without a real route existing.
- Never add a new state manager (Zustand, Redux) — use `useState` + custom events.

## Files to inspect first

- `components/dashboard/XodusCard.tsx` — canonical reactive pattern
- `components/BottomNav.tsx` — nav items array
- `app/globals.css` — card-elevated, glow utilities
- `app/page.tsx` — dashboard composition order

## Verification

Run dev server, check the route visually. Confirm no hydration errors in browser console. Run `npx tsc --noEmit`.
