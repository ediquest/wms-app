
## 2025-08-30
- Fix re-entry overwrite: added guards (`isApplyingRef`, `skipNextPersistRef`) and auto-apply restored tab snapshot without persisting.

- v2: Scope auto-restore to a single run per section entry; moved autoCreateFromValues() before guards to keep UI smooth.

- v3: Debounced snapshot persistence (380ms), removed `tabs` from auto-apply deps, kept `updatedAt` untouched during typing.

- v4: Safe normalizeSnapshot (no fallback to current values), flush pending debounced persist on tab/section switch and on unload.
