# Journey active-scroll + derived count state cumulative patch v3

This cumulative patch includes the previously working Journey active-scroll fixes and adds one targeted runtime-state fix:

- preserves collection-derived runtime state such as `journey.total` when Studio saves/reloads the same page;
- prevents the RuntimeRenderer initial-state synchronization effect from wiping `countStateKey` values immediately after Collection effects calculate them;
- still resets local runtime state when navigating to a different page;
- keeps page-defined initial-state values authoritative when those settings change;
- preserves the active-scroll Preview scroll-root arbitration from v2.

Files replaced:

- `packages/runtime-renderer/src/index.tsx`
- `tests/source-integration.test.mjs`
