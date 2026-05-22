# next-1623-bfnav-disk-cache-repro

  Minimal reproduction for: in `next dev` 16.1+, Chrome's back/forward
  navigation lands on a stale disk-cached HTML response, and Turbopack's
  RSC bootstrap silently fails to hydrate. The page stays on the SSR
  placeholder forever — no console errors, no failed requests.

  Fixed in 16.0.9 by `Cache-Control: no-store, must-revalidate` (Chrome
  cannot disk-cache the document). Broken from 16.1+ after PR
  [#91503](https://github.com/vercel/next.js/pull/91503), which removed the
  `devCacheControlNoCache` experimental option and hard-coded `no-cache`.

  ## Repro

  ```bash
  pnpm install
  pnpm dev

  1. Open http://localhost:3000/ in Chrome.
  2. Wait for the page to render hydrated ✅.
  3. Navigate the address bar to any external site, e.g. https://example.com/.
  4. Click Back.

  Expected

  Page shows hydrated ✅ (or briefly re-renders on a fresh request, then hydrates).

  Actual (Next.js 16.2.3)

  Page is stuck on SSR placeholder ⏳. useEffect never runs.
  DevTools → Network → localhost document: 200 (from disk cache),
  Cache-Control: no-cache, must-revalidate. No errors anywhere.

  Bisect


Workaround (app-side)

Until the upstream change is reverted/adjusted, dev-only client
script can force a reload on bf-nav into a non-bfcached page:

<script>
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) return; // bfcache hit — state is intact
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "back_forward") location.reload();
  });
</script>

Setting Cache-Control: no-store via next.config.ts headers() or
middleware does not override the dev-server-injected header.

Environment

- Next.js 16.2.3 (broken) / 16.0.9 (works)
- React 19
- Chrome 148, macOS 26.5
- Turbopack (default in 16.x)

Related

- PR #91503 (https://github.com/vercel/next.js/pull/91503) — Remove
devCacheControlNoCache experimental option (hard-code no-cache)

  ┌─────────┬───────────────────────────┬─────────────────────────────┐
  │ Next.js │     dev Cache-Control     │     Back/forward result     │
  ├─────────┼───────────────────────────┼─────────────────────────────┤
  │ 16.0.9  │ no-store, must-revalidate │ hydrates ✅                 │
  ├─────────┼───────────────────────────┼─────────────────────────────┤
  │ 16.2.3  │ no-cache, must-revalidate │ stuck on SSR placeholder ❌ │
  └─────────┴───────────────────────────┴─────────────────────────────┘

  To verify, swap the next version in package.json, reinstall, and
  repeat the steps above.

  Why it happens

  - Per HTTP/1.1 and Chrome's documented behavior, Cache-Control: no-cache requires revalidation before reuse — except for
  back/forward navigation, where Chrome is allowed to skip
  revalidation and serve from disk cache.
  - The disk-cached HTML carries __next_f.push(...) payload tied to
  the previous dev-server session/build.
  - Turbopack's RSC bootstrap consumes this stale payload and silently
  no-ops, so React never mounts. No error is surfaced.

  no-store avoided this because Chrome cannot disk-cache the response
  in the first place.

  Workaround (app-side)

  Until the upstream change is reverted/adjusted, dev-only client
  script can force a reload on bf-nav into a non-bfcached page:

  <script>
    window.addEventListener("pageshow", (e)