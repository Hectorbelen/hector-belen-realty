# 🔎 Lofty IDX home-search — setup (staged, ready to flip)

## ⏳ CURRENT STATUS (as of 2026-10-29) — READ FIRST

**Two separate tracks — don't confuse them:**
1. **🔎 IDX home-search** (the "Buscar / Search" buttons → live MLS listings) —
   **waits on the MLS feed.** Staged, nothing to flip on the site until approval.
2. **📨 Lead funnel → Lofty CRM + email** — **does NOT need the MLS.** Being
   connected NOW so leads flow into Lofty from day one. See
   "CRM funnel — connect now" below.

- ✅ Hector set up his **own independent (free DIY) Lofty website**.
- ⏳ **MLS feed approval is in progress — ~10 business days (≈ Nov 10, 2026).**
  Until the board approves the feed, his Lofty IDX won't show live listings.
- ✅ **Custom domain connected (2026-10-29):** `search.hectorbelenrealtor.com`
  linked to his Lofty site via **GoDaddy Domain Connect** ("Do it for me"). DNS
  resolves to Lofty (52.52.24.52 / 52.9.101.47) and the domain is saved in Lofty
  (re-adding says "already exists").
- ⏳ **SSL still provisioning on Lofty's side** as of 2026-10-29 ~22:25 ET: the
  URL returns `403` and serves Lofty's default `chime.me` cert, not one for the
  subdomain. Automatic; usually ready within minutes–hours. **Do NOT flip
  `CONFIG.searchUrl` until `https://search.hectorbelenrealtor.com` loads cleanly**
  (ideally also once listings are live, so the first impression isn't an empty
  search).
- ✅ **Site lead funnel switched to the CRM path** (2026-10-29): `script.js`
  `CONFIG.provider` is now `'function'` — every lead POSTs to the serverless
  handler, which forwards the full qualifier payload to `LEAD_WEBHOOK_URL`.
  Finish the Zapier + Netlify steps below to light it up in Lofty.
- 📌 **Next session (in ~10 days, once MLS is approved):** confirm his Lofty IDX
  is live with listings, get his **personal search URL** (and ask Lofty if a
  **custom domain** `search.hectorbelenrealtor.com` is allowed on the free DIY
  tier — it may not be), then do the steps below. Pick up by reading this file.
- 🎨 Marketing kit (business card, flyer, QR cards) already delivered as a
  separate Artifact — not part of the website repo.

**Decision:** Hector is moving to his **own independent Lofty account** (not LPT's
brokerage Lofty). That's what makes a fully branded search on **his** domain, with
**his** leads, possible. This doc is the turnkey plan for when that account + its
IDX feed are live.

## Why independent (what we learned)
LPT's brokerage Lofty runs the search on **lpthomesearch.com** — Hector couldn't
brand it, use his own domain, or guarantee he keeps the leads. An **independent
Lofty** gives him his own IDX site, custom-domain support, and full lead ownership.

## How it fits together (unchanged)
```
hectorbelenrealtor.com   ──"Buscar/Search"──►   search.hectorbelenrealtor.com
(this site: brand, lead form)                   (HIS Lofty IDX: live MLS + accounts)
        │                                                   │
        └──────── lead (Zapier) ───►  HIS LOFTY CRM  ◄── every save/search/favorite
                                           ▲
                                           └── MLS feed (his own, Lofty-managed)
```

## Credentials rule (important)
Hector enters all logins himself — **MLS credentials and Lofty logins go into
Lofty, never into this website and never pasted to the assistant.** The site only
ever needs the finished public search URL.

## Steps (in order, once the independent Lofty account exists)

### 1. In HIS Lofty — set up the IDX + MLS feed
- Lofty onboarding connects his MLS board feed (he provides/enters his MLS
  credentials there). **Board approval takes a few business days.**
- Confirm the IDX website is live and shows listings.

### 2. In HIS Lofty — turn on a custom domain for the IDX site
- Ask Lofty to use **`search.hectorbelenrealtor.com`** for his IDX site.
- Lofty gives a **target** to point the subdomain at (usually a CNAME host; or
  their default URL like `hectorbelen.lofty.site` if he skips the subdomain).

### 3. In GoDaddy — add ONE DNS record (free; it's a subdomain, not a new domain)
`dcc.godaddy.com` → `hectorbelenrealtor.com` → **DNS → Manage DNS → Add New Record**:

| Type  | Name     | Value / Data                   | TTL    |
|-------|----------|--------------------------------|--------|
| CNAME | `search` | *(the target Lofty gives you)* | 1 Hour |

- Don't touch the existing records (`@` A → 75.2.60.5, `www` CNAME → Netlify, DMARC).
- If Lofty gives an IP instead of a hostname, use an **A** record for `search`.
- Verify: `dig +short search.hectorbelenrealtor.com`

### 4. In this repo — set the search URL and redeploy
Edit **`script.js`** → `CONFIG.searchUrl`:
```js
searchUrl: 'https://search.hectorbelenrealtor.com',
```
(or Lofty's default URL if the subdomain is skipped). Commit + push to `main`;
Netlify auto-deploys.

**What the flip does (already coded):** every "Buscar / Search Homes" button routes
to his live Lofty IDX, and the `#search` section turns into a "Search Homes on the
MLS" launcher. Bilingual copy for both states is in place. Rollback anytime by
setting `searchUrl: ''` and redeploying.

### 5. Wire the contact form → his Lofty CRM (Zapier) — see "connect now" below.

---

## 📨 CRM funnel — connect now (ahead of the MLS)

The site is already set to feed a webhook (`CONFIG.provider = 'function'`). To
light it up, do these in **Hector's own accounts** (logins never go in the repo):

1. **Zapier — create the Zap** (needs Hector's Zapier + Lofty logins):
   - Trigger: **Webhooks by Zapier → Catch Hook**. Zapier gives a **Catch Hook
     URL** — copy it.
   - Action 1: **Lofty → Create Lead**. Map the JSON fields the site sends
     (`name`, `email`, `phone`, `interest`, `timeline`, `area`, `budget`,
     `bedrooms`, `financing`, `propertyAddress`, `message`, `language`, `source`,
     `utm.*`). Full payload shape: bottom of `netlify/functions/submit-lead.js`.
   - Action 2 (**email**): either let **Lofty notify Hector on every new lead**
     (Lofty → notification settings) **or** add a Zapier **Email/Gmail** step to
     `Hectorbelenrealtor@gmail.com`. ⚠️ With `provider:'function'`, leads no
     longer hit Netlify Forms, so **Netlify's built-in email no longer fires** —
     email must come from Lofty or this Zapier step.

2. **Netlify — set the webhook env var**:
   Site configuration → Environment variables → add
   `LEAD_WEBHOOK_URL = <the Zapier Catch Hook URL>` → **redeploy**.

3. **Test**: submit the live form once. Confirm the lead lands in **Lofty** and
   that the **email** arrives. (The function also logs every lead, so nothing is
   lost even if a step is misconfigured — recover from Netlify function logs.)

⚠️ **Sequencing:** set `LEAD_WEBHOOK_URL` *before or at the same time as* the
deploy that ships `provider:'function'`. Until the var is set, leads are accepted
(visitor sees the thank-you) and written to the function logs, but **not forwarded
and not emailed** — so finish steps 1–2 promptly. To pause the CRM path and fall
back to Netlify Forms + email, set `CONFIG.provider` back to `'netlify'`.

## Before switching off LPT's Lofty
- **Export his existing contacts/leads** from the LPT Lofty so nothing is lost
  (own-your-database). Confirm with LPT what he's allowed to take.

## Cost note
Independent Lofty is a **paid subscription** (brokerage one was free) — confirm
current pricing with Lofty before committing.
