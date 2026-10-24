# Security headers

Written by `scripts/headers.mjs` into `dist/_headers` after every `vite build`, and served by
Cloudflare with every static asset. Closes audit finding F4. (`vercel.json` keeps the older,
smaller set for the Vercel host until the domain moves.)

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | see below | Clickjacking was the concrete exploit: with the page framable, an attacker overlays their own UI on a connected session and gets the user to click the real "Send payment" / "Add payee" controls. The passkey ceremony still binds to the real origin — but what the user *believes* they are approving is attacker-controlled. The script and connect lists close what an injected script could do or reach. |
| `X-Frame-Options` | `DENY` | Same control for browsers that honour it ahead of `frame-ancestors`. |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing of served assets. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Treasury and wallet addresses appear in URLs; do not leak the path off-origin. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | No downgrade. `preload` is deliberately omitted — submitting to the preload list is hard to reverse and should be a separate, deliberate decision. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Features the app never uses. **`publickey-credentials-get` is deliberately not restricted** — that is WebAuthn, which passkey login needs. |

## The Content-Security-Policy

- `script-src 'self'` plus the **hash of every inline script** in the build, and the
  analytics beacon. The hashes cannot be written by hand — the docs site inlines a page-hash
  map that changes whenever the docs do — so they are read from the built HTML, CRLF
  normalised the way the browser parses it.
- `connect-src` names every endpoint the app talks to: Horizon (`*.stellar.org`), the
  pinned RPC provider's origin (read from `dist/build-info.json`), `*.supabase.co` over HTTPS
  and WSS, the WalletConnect / Reown set, and the analytics beacon. A wrong list does not
  fail loudly — it silently breaks mobile wallet connect — so it was probed with Chromium
  across the landing, the app pages, the wallet modal and the docs: no violations.
- `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`.
