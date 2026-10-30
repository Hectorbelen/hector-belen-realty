# 🔎 Lofty IDX home-search — setup (staged, ready to flip)

## ⏳ CURRENT STATUS (as of 2026-10-29) — READ FIRST
- ✅ Hector set up his **own independent (free DIY) Lofty website**.
- ⏳ **MLS feed approval is in progress — ~10 business days (≈ Nov 10, 2026).**
  Until the board approves the feed, his Lofty IDX won't show live listings, so
  there is **nothing to connect on the website yet**. Everything below is staged
  and waits on that approval.
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

### 5. Wire the contact form → his Lofty CRM (Zapier)
- Keep Netlify Forms on (backup ledger). Add a Zap: **Netlify: New Form Submission
  → Lofty: Create Lead**. Now both the site's form and the IDX registrations land
  in his Lofty CRM.

## Before switching off LPT's Lofty
- **Export his existing contacts/leads** from the LPT Lofty so nothing is lost
  (own-your-database). Confirm with LPT what he's allowed to take.

## Cost note
Independent Lofty is a **paid subscription** (brokerage one was free) — confirm
current pricing with Lofty before committing.
