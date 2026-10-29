# 🚀 DEPLOY — pick up here (handoff for the next session)

**Goal: turn in a LIVE, WORKING site tonight.** Everything is built and committed.

## Current state (all saved)
- Git: initialized, branch `main`, **working tree clean**, 3 commits. No remote set yet.
- Tooling on this Mac: `git` ✅ · `gh` CLI ❌ not installed · `netlify` CLI ❌ not installed.
- Lead capture: `provider: 'netlify'` → **Netlify Forms** (leads → email + dashboard, zero setup).
- Site is complete: bilingual ES/EN, real logo + LPT mark, qualifying lead form,
  home-search (IDX-ready), standards seals, contact. 1.8 MB, no build step.

## Decisions locked
- Host: **Netlify**, deployed under **Hector's own accounts** (his Gmail) for a clean handoff.
- CRM: **HubSpot free** — set up THIS WEEK (not tonight). Wire later via the serverless
  function (`netlify/functions/submit-lead.js`) + `LEAD_WEBHOOK_URL`. Site doesn't change.
- Testimonials: re-add when Hector's edited videos are ready (section was removed; code ready).
- MLS/IDX: waiting on Hector's vendor info. Site works for buyers without it (fallback CTA).

## Deploy steps (walk the user through, ONE at a time)
1. **Create GitHub repo** under Hector's account (github.com → New repository, empty, Private is fine).
2. **Push** — from this folder:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
   (HTTPS push needs auth: a GitHub Personal Access Token as the password, or install `gh` and `gh auth login`. Resolve auth if it prompts.)
3. **Netlify** (Hector's account) → Add new site → Import from GitHub → pick the repo →
   Deploy. Build settings auto-fill from `netlify.toml` (publish `.`, no build command).
4. **Turn on lead emails**: Netlify → Site configuration → Notifications → add Email
   notification for the `lead` form → `Hectorbelenrealtor@gmail.com`. Send a test submit.
5. **Domain** (GoDaddy → Netlify): README §2a — add domain in Netlify, paste Netlify's 4
   nameservers into GoDaddy. HTTPS auto. (Can follow after the netlify.app URL is live.)

## Still pending before FULL public launch (not tonight's blockers)
- ⚠️ **TCPA consent wording** — LPT must approve (ES + EN). The one legal blocker.
- HubSpot CRM wiring · testimonials · IDX embed · swap LPT's official logo.

> Full project docs: see **README.md** (deploy §2/§2a, lead funnel §3, bilingual §3b, IDX §3c).
