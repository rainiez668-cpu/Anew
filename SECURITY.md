# Security Policy

Anew is a self-hostable app. When you deploy your own copy, **you** control
your AI provider keys. Please handle them carefully.

## Key handling rules

- **Never commit `.env.local`** (or any file containing real keys). It is
  gitignored — keep it that way.
- **Never prefix provider keys with `NEXT_PUBLIC_`.** Any variable starting
  with `NEXT_PUBLIC_` is inlined into the browser bundle and becomes public.
  `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are **server-only** and must stay
  that way — they are only read inside API routes on the server.
- **Set real keys in your host's environment settings** (e.g. Vercel → Project
  Settings → Environment Variables), not in committed files.
- **The public demo should use `AI_PROVIDER=mock`** so no real key is ever
  needed or exposed. Real AI requires self-hosting with your own key.
- If you think a key may have leaked, **rotate it immediately** in your
  provider's dashboard.

## AI endpoint limits

- The built-in request limiter is an **in-memory, single-instance** safeguard.
  It helps local development and the Mock demo, but it is not shared across
  serverless instances and resets on cold starts.
- This build intentionally rejects OpenAI and Anthropic requests in production.
  Do not expose a real provider publicly until a shared rate limiter is
  implemented and enforced for every instance.
- A shared rate limiter is separate from a cost budget. Before enabling a real
  provider, configure that provider's usage limits, budget alerts, and any
  organisation-level spending controls.
- By default, self-hosted deployments do not trust `X-Forwarded-For`. Requests
  without a verified client IP share a conservative rate-limit bucket. If a
  reverse proxy is configured to **overwrite** that header with the direct
  client IP, set `TRUSTED_PROXY_MODE=overwrite-x-forwarded-for`; do not enable
  it for proxies that merely append or pass through client headers.

## Reporting a vulnerability

If you discover a security issue, please report it **privately** — do not open
a public GitHub issue.

- Use GitHub's **Security → Report a vulnerability** (private advisory) on the
  repository, or
- Contact the maintainer directly.

Please include steps to reproduce and the potential impact. We'll acknowledge
your report and work on a fix before any public disclosure.
