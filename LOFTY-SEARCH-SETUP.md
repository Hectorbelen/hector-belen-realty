# 🔎 Lofty IDX home-search — setup (staged, ready to flip)

**What this is:** the live MLS home search (listings, buyer accounts, saved
favorites, saved searches, new-listing alerts) runs on **Hector's Lofty IDX
site**, not on this marketing site. This marketing site stays the front door and
sends buyers into the Lofty search. All buyer activity flows into Lofty CRM.

Everything on the website side is **already staged**. When Lofty's IDX is live,
it's a ~2-minute flip — no rebuild.

## How it fits together
```
hectorbelenrealtor.com   ──"Buscar/Search"──►   search.hectorbelenrealtor.com
(this site: brand, lead form)                   (Lofty IDX: live MLS + accounts)
        │                                                   │
        └──────── lead (Zapier) ───►  LOFTY CRM  ◄── every save/search/favorite
                                           ▲
                                           └── MLS feed (managed by Lofty)
```

## Who does what
- **Lofty** connects the MLS and hosts the search. The **MLS credentials Hector
  is getting go INTO Lofty's IDX setup**, not into this website's code.
- **This site** just links its "Search / Buscar" buttons to the Lofty site, on a
  branded subdomain so buyers never see a Lofty URL.

## Steps (do in this order, once Lofty's IDX site exists)

### 1. In Lofty — get the IDX site address + allow the custom subdomain
- Turn on / confirm the IDX website in Lofty (plug in the MLS data there).
- Confirm Lofty allows a **custom domain/subdomain** for the IDX site (almost all
  plans do). Tell Lofty you want `search.hectorbelenrealtor.com` pointed at it.
- Lofty gives you a **target** to point the subdomain at — usually either:
  - a **CNAME target** (e.g. `sites.lofty.com` / `idx.lofty.com` — use whatever
    Lofty tells you), or
  - their **default URL** (e.g. `hectorbelen.lofty.site`) if you skip the subdomain.

### 2. In GoDaddy — add ONE DNS record for the subdomain
`dcc.godaddy.com` → `hectorbelenrealtor.com` → **DNS → Manage DNS → Add New Record**:

| Type  | Name     | Value / Data                 | TTL    |
|-------|----------|------------------------------|--------|
| CNAME | `search` | *(the target Lofty gives you)* | 1 Hour |

- This is **free** — a subdomain, not a new domain.
- Don't touch the existing records (`@` A → 75.2.60.5, `www` CNAME → Netlify, etc.).
- If Lofty hands you an IP instead of a hostname, use an **A** record for `search`
  with that IP instead of a CNAME.

Verify from a terminal after a few minutes:
```bash
dig +short search.hectorbelenrealtor.com
```

### 3. In this repo — set the search URL and redeploy
Edit **`script.js`** → `CONFIG.searchUrl`:
```js
searchUrl: 'https://search.hectorbelenrealtor.com',
```
(If you skipped the subdomain, use Lofty's default URL instead.)

Commit + push to `main`. Netlify auto-redeploys. Done.

### What the flip does automatically (already coded)
- Every **"Buscar / Search Homes"** button (nav, hero, footer) routes to the
  live Lofty search.
- The `#search` section swaps its "search is being connected" card for a
  **"Search Homes on the MLS"** launcher (`#idxLive` in `index.html`).
- Bilingual (ES/EN) copy for both states is already in place.

## Rollback
Set `searchUrl: ''` and redeploy — instantly back to the in-page fallback. Safe
to flip on/off anytime.

## Notes
- **Keep it on the subdomain.** Lofty's only in-page embed path is their
  **WordPress plugin**; this is a custom static site, so we route to the Lofty
  site rather than rebuilding on WordPress. Buyers get the identical
  save/account/alert experience either way.
- Lofty handles MLS/IDX display compliance on their hosted site.
