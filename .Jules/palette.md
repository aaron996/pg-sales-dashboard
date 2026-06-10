## 2026-06-10 - [Region Filter Refactor]
**Learning:** Consolidated complex filter states into reusable components prevents "state drift" where multiple UI versions (sticky vs main) get out of sync.
**Action:** Always refactor duplicated filter UI into a standalone component with internal visibility management to avoid shared state bugs.

## 2026-06-10 - [Search UX & ARIA]
**Learning:** Providing a visible "Clear Search" button significantly reduces friction for keyboard and mobile users who would otherwise need to backspace characters manually.
**Action:** Include a clear/reset action in all prominent search inputs, paired with appropriate ARIA labels for screen readers.
