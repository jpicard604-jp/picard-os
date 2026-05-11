# Skill: Token-Efficient Debugging — Picard OS

**When to use:** Diagnosing a build error, hydration mismatch, TypeScript error, or runtime crash in this codebase.

## Debugging Protocol

1. **Read the error first** — full message, file, line number. Do not guess.
2. **Read the specific file** — only the file mentioned in the error. Do not read 10 files.
3. **Check one theory** — implement the fix, then verify.
4. **Run `npx tsc --noEmit`** — catches type errors cheaply without a full build.
5. **Run `npm run build`** only after type check passes.

Never spawn a subagent for a single-file bug. Use a subagent only when the error requires understanding 5+ interconnected files simultaneously.

## Common Picard OS Bug Patterns

### Hydration mismatch
- **Cause:** `useState(new Date())` or `useState(getTodayLog())` — different on server vs client
- **Fix:** `useState<Date | null>(null)` + `useEffect` for Date; `useState(EMPTY_CONSTANT)` + `useEffect` for localStorage
- **Files to check:** Any `'use client'` component with `new Date()` or a storage read in `useState`

### Missing `nutritionProfile` on `XodusBrainInput`
- **Cause:** Added field to `XodusBrainInput` interface but not to SSR fallback in `gatherBrainInput()`
- **Fix:** Add field to BOTH the SSR return object AND the client return object. Also add to `EMPTY_BRAIN` in `XodusCard.tsx`.

### `localStorage is not defined`
- **Cause:** Storage read outside `useEffect` or missing `typeof window !== 'undefined'` guard
- **Fix:** Wrap in guard or move to `useEffect`

### `npm audit fix` breaking build
- **Rule:** Never run `npm audit fix`. If security warnings appear, note them and continue.

### Custom event not triggering refresh
- **Cause:** Missing `window.addEventListener` in `useEffect`, or event name typo
- **Fix:** Check `STORAGE_EVENTS` in `lib/storage.ts` for canonical event names. Verify the component adds the listener in `useEffect` with proper cleanup.

### Score not updating after log change
- **Cause:** `DailyStatusExtras` not being re-assembled after storage changes
- **Fix:** Ensure the `refresh()` function in `useEffect` re-reads all extras (stack, projects, activity) and rebuilds the extras object before calling `generateDailyStatus`

## Escalation Criteria (when to use subagent)

Use `Explore` or `general-purpose` subagent when:
- Error spans 5+ files with unclear origin
- Need to audit all components using a specific pattern
- Investigating a regression with unknown surface area

## Token-Saving Patterns

- Read only the file in the error, not the whole feature
- Use `Grep` to find a specific function before `Read`-ing the whole file
- Use `npx tsc --noEmit` before `npm run build` — ~10x faster feedback
- Prefer `Edit` over `Write` for small fixes — sends only the diff

## Files to inspect for common errors

| Error type | First file to read |
|------------|-------------------|
| Build error | The file named in the error |
| Hydration mismatch | The `'use client'` component in the stack trace |
| Score wrong | `lib/daily-status.ts` |
| XODUS brief wrong | `lib/xodus-message.ts` |
| Brain context wrong | `lib/xodus/brain.ts` |
| Storage event not firing | `lib/storage.ts` → `STORAGE_EVENTS` |
