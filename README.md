# hectorbelenrealtor.com

Single-page landing site and lead funnel for **Hector Belen, REALTOR®**.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies —
push the folder to GitHub and connect it to Netlify or Cloudflare Pages.

---

## Contents

1. [Run it locally](#1-run-it-locally)
2. [Deploy](#2-deploy)
3. [The lead funnel + CRM](#3-the-lead-funnel--crm)
3b. [Bilingual (Spanish / English)](#3b-bilingual-spanish--english)
3c. [Home search (IDX / MLS)](#3c-home-search-idx--mls)
3d. [Testimonials (removed for now)](#3d-testimonials-removed-for-now)
4. [Pre-launch checklist](#4-pre-launch-checklist) ← **the important one**
5. [Swapping images](#5-swapping-images)
6. [Editing the gallery](#6-editing-the-gallery)
6a. [The hero motion (Ken Burns)](#6a-the-hero-motion-ken-burns)
7. [Connecting testimonial videos](#7-connecting-testimonial-videos)
8. [Brand colors and type](#8-brand-colors-and-type)
9. [Performance notes](#9-performance-notes)
10. [File map](#10-file-map)

---

## 1. Run it locally

The page uses root-relative paths (`/style.css`), so open it through a local
server rather than double-clicking the file.

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.

**On localhost the lead form skips the network call** and jumps straight to the
thank-you message, with a note in the browser console. There's no form backend
running on your laptop, so this is the only way to preview that state. The check
is keyed strictly to `localhost` / `127.0.0.1`, so it can never fire on the live
site.

---

## 2. Deploy

Either host works. Netlify is simpler because the form backend is built in.

### Netlify (recommended)

1. Push this folder to a GitHub repository.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Build settings — leave both blank (`netlify.toml` already sets them):
   - Build command: *(empty)*
   - Publish directory: `.`
4. Deploy. Forms work immediately — see §3.
5. **Domain settings → Add a custom domain** → `hectorbelenrealtor.com`, then
   point the registrar's nameservers or DNS records at Netlify. HTTPS is
   provisioned automatically.

### Cloudflare Pages

1. Push this folder to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `/`
4. Deploy, then **Custom domains → Set up a domain** → `hectorbelenrealtor.com`.
5. Cloudflare has no form handling, so **you must switch the form to Formspree** —
   see §3.

The `_headers` file (Cloudflare) and `netlify.toml` (Netlify) both set caching
and basic security headers. Keeping both means either host works unchanged.

---

## 3. The lead funnel + CRM

**How a lead flows:** visitor fills the form → `script.js` validates it and POSTs
JSON to a small serverless function (`netlify/functions/submit-lead.js`) → the
function re-validates and forwards a clean payload to your **CRM webhook** → the
visitor sees the inline thank-you. No page reload, no lead lost to a bad browser.

The function also captures **lead attribution** automatically — which language
the visitor used, the page URL, the referrer, and any `?utm_*` ad-campaign tags
— so your CRM knows where every lead came from.

The provider is a one-line switch at the top of [`script.js`](script.js):

```js
var CONFIG = {
  provider: 'function',   // 'function' (CRM) | 'netlify' | 'formspree'
  functionEndpoint: '/.netlify/functions/submit-lead',
  ...
};
```

### Connect your CRM (the `function` path — default)

1. Deploy to Netlify (see §2). The function deploys automatically — it lives in
   `netlify/functions/` and `netlify.toml` points Netlify at that folder.
2. Create an **inbound webhook** that feeds your CRM. Easiest options:
   - **Zapier / Make** — create a "Catch Hook"; it gives you a URL. Then map the
     fields (below) to Follow Up Boss, kvCORE, HubSpot, a Google Sheet, etc.
   - **Go High Level** and some CRMs accept a raw-JSON inbound webhook directly.
   - **Airtable** — an automation triggered by an incoming webhook.
3. In Netlify: **Site configuration → Environment variables → Add a variable**
   - Key: `LEAD_WEBHOOK_URL`
   - Value: the webhook URL from step 2
4. **Redeploy** (env-var changes need a redeploy). Submit a real test from the
   live site and confirm it lands in your CRM.

**The JSON your webhook receives:**

```json
{
  "name": "María González", "email": "maria@example.com",
  "phone": "(407) 555-0142",
  "interest": "Buying", "timeline": "1-3 months", "contactMethod": "WhatsApp",
  "propertyAddress": "", "area": "Kissimmee, Lake Nona",
  "budget": "$350,000", "bedrooms": "3+", "financing": "Pre-approved",
  "message": "Flexible on move-in", "consent": true,
  "language": "es", "source": "website",
  "page": "https://hectorbelenrealtor.com/", "referrer": "https://facebook.com/",
  "utm": { "source": "fb", "medium": "cpc", "campaign": "otono", "term": "", "content": "" },
  "submittedAt": "2026-10-14T18:30:00.000Z"
}
```

The qualifier fields (`timeline`, `contactMethod`, `propertyAddress`, `area`,
`budget`, `bedrooms`, `financing`) are shown **conditionally by intent** — a
seller sees property address, a buyer sees budget/beds/financing, a renter sees
budget/beds (no mortgage field). Unused fields come through as empty strings.
`interest` is a language-independent value (`Buying`/`Selling`/`Renting`/
`BuyingSelling`/`HomeValue`) so your CRM mapping doesn't break between ES and EN.

> **Until `LEAD_WEBHOOK_URL` is set,** the form still works (the visitor sees the
> thank-you) but leads are only written to the function logs, not forwarded.
> Set it before you rely on the site for real leads. The full walkthrough and
> field notes are in the comments at the top of `netlify/functions/submit-lead.js`.

### No-code alternatives

- **`provider: 'netlify'`** — posts straight to **Netlify Forms** (free tier:
  100/month). Leads appear under Site → Forms with email notifications and zero
  setup. Good for an instant capture before the CRM webhook is ready. Turn on the
  email under Site configuration → Notifications → Form submission. (You can also
  wire Netlify Forms → an outgoing webhook to a CRM entirely from the dashboard.)
- **`provider: 'formspree'`** — for non-Netlify hosts. Create a form at
  <https://formspree.io>, paste its id into `formspreeId`.

`script.js` also sets the form's plain `action` to Netlify Forms, so even a
visitor with JavaScript disabled still submits successfully.

### Spam protection

A honeypot field named `company` is hidden off-screen. Humans never see it; bots
fill it in, and those submissions are dropped silently — on the client, in the
function, AND by Netlify Forms. If spam still gets through, add reCAPTCHA (Netlify
supports `data-netlify-recaptcha`; Formspree has a dashboard toggle).

---

## 3b. Bilingual (Spanish / English)

**Spanish is the primary language.** It's the text that actually lives in
`index.html`, so the page reads correctly in Spanish with no JavaScript and
Google indexes it as Spanish (`<html lang="es">`). English is layered on top via
`data-en` attributes and a small runtime in `script.js`. A visitor toggles
**ES / EN** in the nav; the choice is saved in `localStorage` and remembered on
the next visit.

### How to edit or add translations

Every translatable element holds the **Spanish** text as its content and the
**English** in a `data-en` attribute:

```html
<h2 data-en="Held to a national standard">Regido por un estándar nacional</h2>
```

- Edit the **Spanish** by changing the element's text (between the tags).
- Edit the **English** by changing the `data-en` value.
- If the English needs HTML (a `<br>`, a `<span>`), put it in `data-en` with the
  angle brackets/quotes written as entities, e.g.
  `data-en="Two-story new build · &lt;span class=&quot;price&quot;&gt;Closed&lt;/span&gt;"`.
- Attributes have their own keys: `data-en-alt` (image alt), `data-en-aria-label`,
  `data-en-placeholder` (inputs), `data-en-caption` (gallery lightbox captions).

To add a **new** translatable element, write the Spanish as its content and add
`data-en="…"`. Nothing else needed — the runtime finds it automatically.

### Strings that live in JavaScript

A few strings are generated by JS, not HTML: the form's validation messages, the
submit button label, and the network-error message. They're in the
`I18N_STRINGS` object near the top of `script.js`, with `es` and `en` blocks.
The page `<title>` and meta description swap from `I18N_META` in the same file.

### Things to double-check before launch

- **Have a native speaker proofread the Spanish.** It was written in a warm,
  professional "usted" register suited to the Florida market, but Hector should
  confirm it sounds like him. Read the About paragraphs and the hero aloud.
- The **TCPA consent line** needs LPT's approved wording in **both** languages.
- The two national seals (see §5b below) carry their official English wordmarks
  ("EQUAL HOUSING OPPORTUNITY", "REALTOR®") in both language modes — that's
  correct; those are the marks' legal names and shouldn't be translated.

### The national-standards seals

`assets/img/seal-realtor.svg` and `assets/img/seal-equal-housing.svg` are the two
credibility marks, rebuilt as crisp navy SVGs. They appear twice: large in the
new **"Regido por un estándar nacional" / "Held to a national standard"** section
(`#standards`, between Testimonials and Contact), and small in the footer badge
row. `.badge-invert` flips them to white on the dark footer. To use official
NAR / HUD artwork instead, drop a PNG/SVG at those two paths.

---

## 3c. Home search (IDX / MLS)

The **"Encuentre su próxima casa" / "Find your next home"** section (`#search`,
right after the gallery) is where Hector's live MLS search goes. It's wired to
accept his **IDX vendor's embed** (IDX Broker, iHomefinder, Showcase IDX,
RealGeeks, etc.).

**To make the search live:**

1. In the IDX vendor dashboard, get the embed snippet for a search page.
2. Open `index.html`, find `<div class="idx-embed" id="idxEmbed">`, and paste the
   snippet where it says `PASTE IDX VENDOR EMBED HERE`.
   - An **`<iframe>`** snippet: paste as-is. The CSS stretches it to full width.
   - A **`<script>`** snippet: paste it inside the container; it injects the
     widget where it sits. (If the vendor says the script must go in `<head>`,
     put it there and leave their target `<div>` in the container.)
3. Delete the `<div class="idx-fallback">…</div>` block (the interim message).

No Content-Security-Policy is set, so third-party IDX iframes/scripts load
without extra config. If you add a CSP later, allow the vendor's domain in
`frame-src` / `script-src`.

**Legal note:** displaying live MLS listings requires an active **IDX data
license** from Hector's MLS board plus the vendor account above. This is already
handled on his side (he has a vendor) — this section just hosts the embed.

Most IDX vendors also capture buyer registrations and send *those* leads into
their own system; if you want them in the same CRM as the form, point the
vendor's lead routing at the same Zapier/webhook (§3).

---

## 3d. Testimonials (removed for now)

The video-testimonials section was **removed** at the client's request until the
real videos are edited. The click-to-load player code still lives in `script.js`
(harmless, dormant). To bring the section back when the videos are ready, see
[§7](#7-connecting-testimonial-videos) — re-add the `<section class="testimonials">`
markup (bilingual, with `data-en` attributes like the rest of the page) and the
`#testimonials` links in the nav and footer.

---

## 4. Pre-launch checklist

Much of Hector's real information is now in (see the table below). What remains
is listed after it. Search the codebase to find every outstanding spot in
context — each has an HTML comment explaining what it needs.

```bash
grep -rn "PLACEHOLDER\|\[INSERT\|\[CITY\]\|\[ADDRESS\]\|\[PRICE\]" index.html script.js style.css
```

### ✅ Already done — real content is in

These came from Hector and are live in the page. Listed so nobody "fixes"
them back to placeholders.

| Item | Value |
|------|-------|
| Phone | (407) 272-2898 — contact section, thank-you, footer, `script.js` error |
| Email | Hectorbelenrealtor@gmail.com |
| Market | All of Central Florida + the Tampa area |
| Experience | 20+ years in the housing industry, 7 as a licensed REALTOR® |
| Brokerage | LPT Realty, LLC |
| Office | 1400 S International Pkwy #1020, Lake Mary, FL 32746 |
| FL license | SL3496104 |
| Instagram / Facebook | @hectorbelenrealtor |
| Brokerage license | Corp. CQ1064576 · Principal Broker BK3378992 |

### ⚠️ Legal — do not launch without these

| # | Item | Where |
|---|------|-------|
| ☐ | **Written photo releases from every client shown in the gallery** — four cards show identifiable people. Most brokerages require a signed release, and a client posting the photo themselves is not consent to use it in advertising. | `#gallery` |
| ☐ | LPT Realty compliance sign-off on the disclosure wording — Florida has specific rules, and LPT will have its own approved language. **Use theirs over what's written here.** | footer |
| ☐ | Broker approval of the consent checkbox wording (TCPA) | contact form |
| ☐ | Confirm LPT's rules on logo size/placement for their mark | footer badges + `#standards` |
| ☐ | Native-speaker proofread of all Spanish copy | throughout |
| ☐ | TCPA consent wording in **both** Spanish and English | contact form |
| ☐ | Confirm Hector has permission to display every property shown | `#gallery` |

### Content

| # | Item | Where |
|---|------|-------|
| ☐ | Read the three About paragraphs aloud with Hector — they're built from his facts but not yet his voice; the origin story especially | `#about` |
| ✅ | ~~Gallery / Trabajo Reciente~~ — section removed for now; re-add when good listing media is ready | — |
| ☐ | Paste the IDX vendor embed into the Home Search section (§3c) | `#search` |
| ☐ | LinkedIn + YouTube URLs, or delete those two icons | footer |
| ☐ | Verify the hero subheadline sounds like Hector | `#hero` |
| ✅ | ~~Testimonials~~ — section removed for now; re-add when videos are edited (§3d) | — |

### Assets

**Four image files still need to be saved into the project.** The page already
references them at these exact paths — save the files and they appear, no code
changes needed. Three currently show labeled "PENDING" placeholder boxes.

| # | Save this | To this exact path |
|---|-----------|--------------------|
| ☐ | Hector's headshot (tan blazer) | `assets/img/hector-headshot.jpg` |
| ☐ | lpt realty logo — **transparent PNG** | `assets/img/lpt-realty-logo.png` |
| ✅ | REALTOR® seal — rebuilt as SVG, no file needed | `assets/img/seal-realtor.svg` |
| ✅ | Equal Housing seal — rebuilt as SVG, no file needed | `assets/img/seal-equal-housing.svg` |

Two notes on those:

- **Don't pre-invert the REALTOR® and Equal Housing marks.** They ship as solid
  black artwork, and the CSS (`.badge-invert`) flips them to white for the dark
  footer. Keeping the source files black means they're still correct if you
  reuse them in print or on a light background.
- **The lpt realty logo needs a transparent background.** The version with the
  dark navy box baked in will render as a visible rectangle against the footer.

**Plus the 14 gallery photo files** — 7 photos × 2 sizes. Thumbnails are
900×675, lightbox versions 1800×1200. All currently show labeled "PHOTO
PENDING" placeholders:

| Save this photo | As |
|---|---|
| Single-story home with the SOLD sign | `closing-1625.jpg` + `closing-1625-full.jpg` |
| Buyers + Hector, "I Said Yes To The Address" | `yes-to-address.jpg` + `-full.jpg` |
| Buyers with the giant key, Sunset Park | `keys-3716.jpg` + `-full.jpg` |
| Three family members in the garage doorway | `family-3795.jpg` + `-full.jpg` |
| Hector + client at The Closing Agent | `closing-table.jpg` + `-full.jpg` |
| Hector outside the LPT office (closer) | `lpt-office.jpg` + `-full.jpg` |
| LPT office building, wide shot | `lpt-office-wide.jpg` + `-full.jpg` |

If you'd rather not resize twice, save one file as `<slug>.jpg` and edit that
card's `data-full` to point at it too — the lightbox will just show the
smaller image.

Other assets:

| # | Item | Where |
|---|------|-------|
| ✅ | Real logo added — emblem badge in the header, full logo in the footer | `/assets/img/logo-emblem.jpg`, `logo-full.jpg` |
| ✅ | Favicon + home-screen icon — real H emblem | `/assets/favicon.png`, `apple-touch-icon.png` |
| ☐ | Hero still image at 3 sizes — the mobile background and the video's poster | `/assets/img/hero-*.jpg` |
| ✅ | Social share image (logo on black, 1200×630) | `/assets/img/og-image.jpg` |
| ☐ | Confirm brand hex codes against the final brand board | `style.css` `:root` |

### Technical

| # | Item | Where |
|---|------|-------|
| ☐ | **Set `LEAD_WEBHOOK_URL` in Netlify** to your CRM webhook, then send a real test lead end-to-end | §3 |
| ☐ | (Optional) turn on Netlify Forms email as a backup capture | §3 |
| ☐ | Update `<lastmod>` | `sitemap.xml` |
| ☐ | Add the site to Google Search Console and submit the sitemap | — |
| ☐ | Add analytics if wanted (a conversion hook is marked in `script.js`) | `showThanks()` |
| ☐ | Delete the yellow `[PLACEHOLDER]` chips as content is filled in | `.ph` spans |
| ☐ | Run Lighthouse on the deployed URL, not localhost | §9 |

### Hiding the placeholder chips for a client demo

The yellow `[PLACEHOLDER]` badges are `<b class="ph">` spans. To hide them all
temporarily without deleting anything, add this to the bottom of `style.css`:

```css
.ph { display: none; }
```

Delete the spans properly as you fill in real content.

---

## 5. Swapping images

All imagery lives in `/assets/img/`. **Every file there is a generated
placeholder.** Keep the same filenames and nothing else needs to change.

| File | Size | What it should be |
|------|------|-------------------|
| `hero-760.jpg` | 760×950 | Hero, mobile crop (portrait) |
| `hero-1200.jpg` | 1200×900 | Hero, tablet |
| `hero-2000.jpg` | 2000×1200 | Hero, desktop |
| `hector-headshot.jpg` | 900×1125 | Portrait, 4:5 |
| `listing-01.jpg` … `-08.jpg` | 900×675 | Gallery thumbnails, 4:3 |
| `listing-01-full.jpg` … `-08-full.jpg` | 1800×1200 | Lightbox versions |
| `testimonial-1-poster.jpg` … `-3-` | 1280×720 | Video posters, 16:9 |
| `og-image.jpg` | 1200×630 | Social share preview |

Tips:

- **Export as JPEG at quality ~80.** Aim for under 250 KB each; the hero can go
  to ~400 KB. Every placeholder here is under 60 KB — try to stay close.
- **Keep the aspect ratios.** The CSS uses `object-fit: cover`, so an off-ratio
  image won't break the layout, but it will crop in ways you didn't choose.
- The hero mobile crop is portrait on purpose — a landscape photo squeezed into
  a phone screen loses its subject.
- **Update the `alt` text** whenever you swap an image. The current alt text
  describes what the real photo *should* show, which makes it easy to spot what
  still needs replacing.
- If you want WebP as well, wrap each `<img>` in a `<picture>` with a
  `<source type="image/webp">` above it. Not required — JPEG at these sizes is
  already fast.

---

## 6. Editing the gallery

Each card in `#gallery` is one `<figure class="card">` block. Copy or delete them
freely — the grid and the filter counts adapt on their own.

```html
<figure class="card reveal" data-tags="sold featured">
  <button class="card-btn"
          data-full="/assets/img/listing-01-full.jpg"
          data-caption="Coastal Contemporary — 123 Main St, Springfield · Sold for $845,000">
    <img src="/assets/img/listing-01.jpg" loading="lazy" decoding="async"
         width="900" height="675"
         alt="Front elevation of a coastal contemporary home with floor-to-ceiling glass">
    <span class="card-zoom" aria-hidden="true">View</span>
  </button>
  <figcaption>
    <h3>Coastal Contemporary</h3>
    <p>123 Main St · 4 bd · 3 ba · <span class="price">Sold $845,000</span></p>
  </figcaption>
</figure>
```

- `data-tags` drives the filter buttons. Valid values: `sold`, `featured`,
  `luxury`. Space-separated, and a card can carry several.
- To add a new filter, add a button in the `.filters` row with a matching
  `data-filter` value, then tag the relevant cards:

  ```html
  <button class="filter" data-filter="new-construction" aria-pressed="false">New Construction</button>
  ```

- `data-full` is the lightbox image; `data-caption` is the line beneath it.
- Arrow keys and swipes move between photos, and the lightbox respects the active
  filter — filter to "Sold" and the arrows only cycle sold properties.

---

## 6a. The hero motion (Ken Burns)

`#top` shows a single still photo (`/assets/img/hero-*.jpg`) with a slow
pan-and-zoom applied entirely in CSS — the `.hero-media img` rule in
`style.css`. It gives the cinematic drift of b-roll footage with none of a
video's weight: the motion is one GPU `transform` animation, so it costs
nothing to download and stays smooth on low-end devices.

- **Speed / distance** live in the `@keyframes heroKenBurns` block and the
  `animation` shorthand. It runs 30s `ease-in-out infinite alternate`, so it
  breathes out and back rather than snapping. Slow it down by raising the 30s;
  make the move bigger by widening the `scale()` / `translate()` gap.
- The image never drops below `scale(1.06)`, which keeps a margin on every
  edge so the pan never exposes a border.
- `prefers-reduced-motion` disables it and shows a static frame.

**This is aspirational stock photography** (a stone home at sunset), used as an
atmospheric backdrop — standard practice, but never caption it as one of
Hector's own listings. Swap in a real twilight exterior he's sold when there is
one; keep the three filenames (`hero-760/1200/2000.jpg`) and nothing else
changes. The mobile file is a portrait crop so the house survives a phone frame.

*(The earlier 52 MB 4K hero video was dropped in favor of this — same feel,
~400 KB instead of 52 MB. The two source `.mp4` files were removed from the
project; your originals remain on your Desktop/Downloads.)*

---

## 7. Connecting testimonial videos

The videos use a **facade**: the page shows a poster image and a play button, and
the YouTube/Vimeo iframe is only created when someone clicks. That keeps roughly
1 MB of third-party JavaScript per video off the initial load (worth about 15–25
Lighthouse points across three embeds) and makes it impossible for a video to
autoplay with sound.

To connect a real video, edit two attributes on the `.video` button:

```html
<!-- YouTube:  https://www.youtube.com/watch?v=dQw4w9WgXcQ  →  id is dQw4w9WgXcQ -->
<button class="video" data-provider="youtube" data-id="dQw4w9WgXcQ" ...>

<!-- Vimeo:    https://vimeo.com/76979871                   →  id is 76979871 -->
<button class="video" data-provider="vimeo" data-id="76979871" ...>
```

Then replace the poster image. YouTube's own thumbnail works:
`https://i.ytimg.com/vi/<VIDEO_ID>/maxresdefault.jpg` — download it and save it
over `/assets/img/testimonial-N-poster.jpg`.

Also update the `aria-label` on the button (it becomes the iframe title), the
`alt` text, the quote and the client name.

Until a real id is filled in, clicking a video shows a "Video not connected yet"
message instead of a broken player — so a half-finished handoff never looks
broken to a visitor.

YouTube embeds use `youtube-nocookie.com`, which doesn't set tracking cookies
until playback starts. That keeps the site out of cookie-banner territory.

---

## 8. Brand colors and type

### Colors

All three brand colors are defined once at the top of `style.css`:

```css
:root {
  --navy:  #1B2A41;
  --gold:  #C9A44C;
  --cream: #F7F4EF;
}
```

Change those three values and the whole site follows. The tints below them
(`--navy-700`, `--gold-100`, etc.) are hand-picked derivatives — if you change
the base colors significantly, nudge those to match.

Two hex values are **not** in the token block and need a manual update if the
brand changes: the inline logo SVG in `index.html` (twice, `#C9A44C`) and
`/assets/favicon.svg`.

### Type

- Display: **Cormorant Garamond** (serif)
- Body/UI: **Jost** (geometric sans)

Loaded from Google Fonts with `preconnect` and `display=swap`, so they never
block the first paint. To self-host them — worth 3–5 Lighthouse points and it
removes a third-party request:

1. Download both families from <https://fonts.google.com> (or use
   <https://gwfh.mranftl.com> to get the woff2 files directly).
2. Drop the `.woff2` files in `/assets/fonts/`.
3. Replace the `<link>` tags in `<head>` with `@font-face` rules in `style.css`,
   each with `font-display: swap;`.

### The logo

The logo is **inlined in `index.html` in two places** (header and footer) rather
than loaded via `<img>`. That's deliberate: the wordmark uses `fill="currentColor"`
so it flips from cream over the hero to navy once the nav goes solid, and an
`<img>` can't inherit color from the page.

`/assets/logo.svg` holds the same artwork as a standalone file for anyone who
needs it (email signatures, listing flyers).

To swap in the final logo, paste the new SVG markup into both spots. If the new
logo doesn't need to invert — a fixed-color or raster logo — you can simplify to:

```html
<img src="/assets/logo.svg" class="brand-logo" alt="Hector Belen, REALTOR®"
     width="170" height="32">
```

…but you'll then want a light version for the scrolled nav.

---

## 9. Performance notes

The page is built to score 90+ on Lighthouse. **Test the deployed URL, not
localhost** — a local `python -m http.server` has no compression or caching and
will score meaningfully worse than the real thing.

What's already done:

- Hero image preloaded with `fetchpriority="high"` and served at three sizes
- Every other image `loading="lazy"` + `decoding="async"`
- `width`/`height` on every image, and `aspect-ratio` on the containers, so
  nothing shifts as images load (keeps CLS at zero)
- Video embeds deferred behind a click facade (§7)
- No frameworks, no jQuery, no icon font — about 15 KB of CSS and JS combined
- One passive, `requestAnimationFrame`-throttled scroll listener
- Long cache headers on `/assets/*` via `netlify.toml` / `_headers`

If you replace an image and don't see the change, that's the year-long cache
header doing its job — hard-refresh, or rename the file.

Accessibility and resilience are handled too: skip link, focus trap in the
lightbox and mobile menu, `prefers-reduced-motion` respected throughout,
keyboard navigation everywhere, and `aria-live` error messages on the form. With
JavaScript disabled the page still renders completely and the form still posts.

---

## 10. File map

```
.
├── index.html          Entire page — all content and copy lives here
├── style.css           All styles. Brand tokens at the top, sections in page order
├── script.js           All behavior. CONFIG block at the top is the part you edit
├── README.md           This file
├── netlify.toml        Netlify build + functions + headers config
├── _headers            Cloudflare Pages headers config
├── robots.txt
├── sitemap.xml
├── netlify/
│   └── functions/
│       └── submit-lead.js   Serverless lead handler → forwards to your CRM webhook
├── .claude/
│   └── launch.json     Local preview config (harmless to delete)
└── assets/
    ├── logo.svg            Standalone logo file
    ├── favicon.svg
    ├── apple-touch-icon.png
    ├── img/                Photography + the two SVG credibility seals
        (seal-realtor.svg, seal-equal-housing.svg)
```

Still no build step and no `node_modules` to install — the one serverless
function is a single plain `.js` file Netlify runs for you. Anyone who knows HTML
can maintain the page; the CRM wiring is just the `LEAD_WEBHOOK_URL` env var.
