/* ============================================================================
   Hector Belen, REALTOR® — interactions
   ----------------------------------------------------------------------------
   Plain ES2019 JavaScript. No dependencies, no build step, no polyfills needed
   for any browser from the last ~5 years. Everything degrades gracefully: with
   JS disabled the page still reads, the form still posts, and the gallery still
   shows every photo.

   Sections:
     0. CONFIG          ← the only part you normally need to edit
     1. Helpers
     2. Sticky nav + mobile menu + scroll spy
     3. Scroll reveals
     4. Animated trust-bar counters
     5. Gallery filters
     6. Lightbox
     7. Click-to-load video embeds
     8. Lead form: validation + AJAX submit
     9. Footer year
   ========================================================================= */

(function () {
  'use strict';

  /* =========================================================== 0. CONFIG === */
  var CONFIG = {

    /* Where lead submissions go. 'netlify' | 'function' | 'formspree'.
       ------------------------------------------------------------------
       'netlify' (ACTIVE) — posts straight to Netlify Forms. Leads land in
                    Hector's email AND a list under Site → Forms in the Netlify
                    dashboard — a working lead inbox with zero extra accounts.
                    After the first deploy, turn on the email notification
                    (README §3). This is the current turn-in setup.

       'function' — the CRM-connected path. Posts to the serverless function
                    at functionEndpoint, which forwards the lead to your CRM
                    webhook (set LEAD_WEBHOOK_URL in Netlify). Switch to this
                    when Hector adds a real CRM — the function is already built
                    (netlify/functions/submit-lead.js) and carries all the
                    qualifying fields. See README §3.

       'formspree' — for hosts that aren't Netlify. Create a form at
                    https://formspree.io and paste its id into formspreeId. */
    provider: 'netlify',

    /* Serverless lead handler. Default path is correct for Netlify. */
    functionEndpoint: '/.netlify/functions/submit-lead',

    /* Your Formspree form id — only used when provider is 'formspree'. */
    formspreeId: 'PLACEHOLDER_FORM_ID',

    /* Netlify Forms needs the POST to hit a real static page. '/' is correct. */
    netlifyAction: '/',

    /* ---- HOME SEARCH (Lofty IDX) ------------------------------------------
       Hector's live MLS search runs on his Lofty IDX site. Until that site is
       live, leave this EMPTY: every "Buscar / Search" button scrolls to the
       in-page #search section (the "search is being connected" card), and the
       marketing site behaves exactly as it does today.

       THE DAY LOFTY GIVES YOU THE IDX ADDRESS: set this to it and redeploy.
         • Best:   your branded subdomain  'https://search.hectorbelenrealtor.com'
         • Or:     Lofty's default URL      'https://hectorbelen.lofty.site' (example)
       Once set, every search button routes straight to the live MLS search and
       the #search section turns into a "Search Homes on the MLS" launcher.
       Nothing else changes. Full steps: LOFTY-SEARCH-SETUP.md */
    searchUrl: '',

    /* ---- IDX / MLS EMBED (optional) ---------------------------------------
       If your IDX/MLS vendor gives you an EMBEDDABLE search URL (an iframe src
       — e.g. from IDX Broker, iHomefinder, Showcase IDX, RealGeeks, or Lofty's
       embed option), paste it here. When set, it renders as a live, in-page
       search iframe inside the #search section. Leave EMPTY to show the
       friendly fallback card with the "Dígame Qué Busca" button.

       Difference from searchUrl above:
         • idxEmbedUrl  → embeds the search INSIDE this page (iframe).
         • searchUrl    → re-points the "Search / Buscar" buttons to an external
                          site (e.g. search.hectorbelenrealtor.com).
       You can set either, both, or neither. See the "Needs from LPT/MLS" note
       in the final report / LOFTY-SEARCH-SETUP.md for what to request. */
    idxEmbedUrl: '',

    /* Minimum / maximum digits accepted in the phone field. 10 covers US
       numbers; the upper bound leaves room for country codes. */
    phoneDigits: { min: 10, max: 15 },

    /* Contact email — change it here in ONE place and every mailto link + label
       marked data-email updates automatically.
       TODO (branded email): switch to hector@hectorbelenrealtor.com once that
       mailbox is set up. Keeping Gmail for now. NOTE: the email also appears
       statically in the <head> JSON-LD + the /privacy/ and /terms/ pages —
       update those by hand when the branded address goes live. */
    contactEmail: 'Hectorbelenrealtor@gmail.com',

    /* ---- ANALYTICS (optional, consent-gated) ------------------------------
       Paste IDs to enable. EMPTY = no analytics AND no cookie banner — the
       privacy-preserving default. When an ID is set, a cookie-consent banner
       appears and the scripts load ONLY after the visitor clicks Accept. */
    analytics: {
      ga4Id: '',          /* e.g. 'G-XXXXXXXXXX' (Google Analytics 4) */
      metaPixelId: ''     /* e.g. '123456789012345' (Meta / Facebook Pixel) */
    }
  };

  /* When you open index.html straight off your laptop there is no Netlify or
     Formspree endpoint to POST to, so the submit would always fail. On
     localhost (and file://) we skip the network call and show the thank-you
     state instead, with a console warning. This can never trigger on the live
     domain — it's keyed strictly to local hostnames. */
  var IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0', ''].indexOf(location.hostname) !== -1;


  /* ========================================================== 1. Helpers === */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /* Shared focus-trap used by the mobile menu and the lightbox. */
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapFocus(container, event) {
    var items = $$(FOCUSABLE, container).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0];
    var last  = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }


  /* ============================================= 1b. Bilingual (ES / EN) === */
  /* Spanish is primary: it's the text already in the HTML. English lives in
     data-en* attributes. This module swaps between them, remembers the choice,
     and keeps the <title>, meta description, <html lang>, and the form's
     JavaScript-generated strings in sync.

     HOW TO ADD A TRANSLATABLE STRING later: write the Spanish as the element's
     content, add data-en="English". For attributes use data-en-alt /
     data-en-aria-label / data-en-placeholder / data-en-caption. For strings
     that JS generates (validation errors, the submit button), add them to
     I18N_STRINGS below. */

  var LANG = 'es';                       // current language; 'es' is default
  var langCache = new WeakMap();         // element -> its Spanish snapshot

  /* data-en-<suffix> attribute  ->  the real attribute it drives.
     'html' is special: it means the element's innerHTML. */
  var I18N_ATTRS = [
    { data: 'data-en',            attr: 'html' },
    { data: 'data-en-alt',        attr: 'alt' },
    { data: 'data-en-aria-label', attr: 'aria-label' },
    { data: 'data-en-placeholder',attr: 'placeholder' },
    { data: 'data-en-caption',    attr: 'data-caption' }
  ];

  /* Head/meta swaps that aren't simple element text. A sub-page (privacy, terms,
     /compradores, …) can define its own title + description by setting
     window.PAGE_META before this script loads; otherwise the homepage values
     below are used. */
  var I18N_META = window.PAGE_META || {
    es: {
      title: 'Hector Belen, REALTOR® | Casas en el Centro de Florida y Tampa',
      description: '¿Comprando o vendiendo en el Centro de Florida o Tampa? Hector Belen contesta su propio teléfono y le da una valuación gratis, sin compromiso.'
    },
    en: {
      title: 'Hector Belen, REALTOR® | Central Florida & Tampa Homes',
      description: "Buying or selling in Central Florida or Tampa? Hector Belen answers his own phone and gives you a free home valuation, no obligation."
    }
  };

  /* Strings generated by JavaScript (not present as static HTML). */
  var I18N_STRINGS = {
    es: {
      err_name:     'Por favor ingrese su nombre.',
      err_email:    'Ingrese un correo electrónico válido.',
      err_phone:    'Ingrese un teléfono válido, ej. (555) 123-4567.',
      err_interest: 'Indíqueme qué está buscando.',
      err_timeline: 'Indíqueme para cuándo planea mudarse.',
      err_consent:  'Marque esta casilla para que pueda responderle.',
      sending:      'Enviando…',
      submit:       'Contactar a Hector',
      send_error:   'Algo salió mal al enviar su mensaje. Intente de nuevo o ' +
                    'llámeme directamente al <a href="tel:+14072722898">(407) 272-2898</a>.'
    },
    en: {
      err_name:     'Please enter your name.',
      err_email:    'Please enter a valid email address.',
      err_phone:    'Please enter a valid phone number, e.g. (555) 123-4567.',
      err_interest: "Let me know what you're looking for.",
      err_timeline: "Let me know your timeline to move.",
      err_consent:  "Please check this box so I know it's okay to reply.",
      sending:      'Sending…',
      submit:       'Contact Hector',
      send_error:   'Something went wrong sending your message. Please try again, ' +
                    'or reach me directly at <a href="tel:+14072722898">(407) 272-2898</a>.'
    }
  };
  /* Read a JS string in the active language. */
  function t(key) { return (I18N_STRINGS[LANG] || I18N_STRINGS.es)[key]; }

  /* Other modules register a callback here to refresh themselves on a switch
     (e.g. the form re-renders visible validation errors + the button label). */
  var langListeners = [];
  function onLangChange(fn) { langListeners.push(fn); }

  function snapshot(el) {
    var snap = {};
    I18N_ATTRS.forEach(function (m) {
      if (!el.hasAttribute(m.data)) return;
      snap[m.data] = m.attr === 'html' ? el.innerHTML : el.getAttribute(m.attr);
    });
    return snap;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'es') lang = 'es';
    LANG = lang;

    $$('[data-en], [data-en-alt], [data-en-aria-label], [data-en-placeholder], [data-en-caption]')
      .forEach(function (el) {
        if (!langCache.has(el)) langCache.set(el, snapshot(el)); // cache Spanish
        var es = langCache.get(el);
        I18N_ATTRS.forEach(function (m) {
          if (!el.hasAttribute(m.data)) return;
          var val = lang === 'en' ? el.getAttribute(m.data) : es[m.data];
          if (val == null) return;
          if (m.attr === 'html') el.innerHTML = val;
          else el.setAttribute(m.attr, val);
        });
      });

    document.documentElement.setAttribute('lang', lang);
    if (I18N_META[lang]) {
      document.title = I18N_META[lang].title;
      var desc = $('meta[name="description"]');
      if (desc) desc.setAttribute('content', I18N_META[lang].description);
    }

    // Toggle button state
    $$('.lang-btn').forEach(function (b) {
      var active = b.getAttribute('data-lang') === lang;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });

    try { localStorage.setItem('lang', lang); } catch (e) {}
    langListeners.forEach(function (fn) { try { fn(lang); } catch (e) {} });
  }

  // Wire the toggle buttons.
  $$('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
  });

  // Apply the saved preference on load (default Spanish — already in the HTML).
  var savedLang = 'es';
  try { savedLang = localStorage.getItem('lang') || 'es'; } catch (e) {}
  setLang(savedLang);


  /* ====================================== 2. Sticky nav + menu + scroll spy */
  var header   = $('#siteHeader');
  var navMenu  = $('#navMenu');
  var navToggle = $('#navToggle');

  /* Shrink/solidify the header once the hero starts scrolling away. */
  var lastStuck = null;
  function updateHeader() {
    var stuck = window.scrollY > 40;
    if (stuck !== lastStuck) {          // only touch the DOM when it changes
      header.classList.toggle('is-stuck', stuck);
      lastStuck = stuck;
    }
  }

  /* Mobile drawer */
  function setMenu(open) {
    navMenu.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
  }

  /* ---- Home search routing (Lofty IDX) -----------------------------------
     When CONFIG.searchUrl is set, every in-page "#search" button is repointed
     at the live Lofty IDX site, and the #search section swaps its "being
     connected" card for a live launcher. When it's empty (today), nothing
     changes — the buttons scroll to the in-page section. Runs before the
     scroll-spy below so repointed links drop out of the spy cleanly. */
  (function wireSearch() {
    var embedUrl = (CONFIG.idxEmbedUrl || '').trim();
    var url      = (CONFIG.searchUrl || '').trim();
    var container = $('#idxEmbed');
    var live      = $('#idxLive');
    var fallback  = $('#idxFallback');

    /* 1) Preferred: a real in-page IDX/MLS iframe embed. When a vendor embed
       URL exists, drop the iframe in and hide both launcher cards. */
    if (embedUrl && container) {
      if (fallback) fallback.hidden = true;
      if (live) live.hidden = true;
      var frame = document.createElement('iframe');
      frame.className = 'idx-frame';
      frame.src = embedUrl;
      frame.title = LANG === 'en' ? 'Home search on the MLS' : 'Búsqueda de casas en el MLS';
      frame.loading = 'lazy';
      frame.setAttribute('allowfullscreen', '');
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      container.appendChild(frame);
    }

    /* 2) External launcher: re-point every "#search" button at the standalone
       IDX site. (Still useful alongside an embed, or on its own.) */
    if (url) {
      $$('a[href="#search"]').forEach(function (a) {
        a.setAttribute('href', url);
        a.removeAttribute('data-scroll');
      });
      if (!embedUrl) {
        if (fallback) fallback.hidden = true;
        if (live) {
          live.hidden = false;
          var btn = live.querySelector('a.btn');
          if (btn) btn.setAttribute('href', url);
        }
      }
    }
    /* 3) Neither set → the "being connected" fallback card (default HTML) stays,
       with its "Dígame Qué Busca" button pointing at the contact form. */
  })();

  /* Any nav click closes the drawer. Smooth scrolling is handled by CSS
     (scroll-behavior + scroll-padding-top), so we don't fight the browser. */
  $$('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (navMenu) setMenu(false);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navMenu && navMenu.classList.contains('is-open')) {
      setMenu(false);
      navToggle.focus();
    } else if (e.key === 'Tab' && navMenu && navMenu.classList.contains('is-open')) {
      trapFocus(navMenu.parentNode, e);
    }
  });

  /* Click outside the open drawer closes it. */
  document.addEventListener('click', function (e) {
    if (!navMenu || !navMenu.classList.contains('is-open')) return;
    if (!header.contains(e.target)) setMenu(false);
  });

  /* Scroll spy — underlines the nav link for the section you're looking at. */
  var navLinks = $$('.nav-menu a[href^="#"]:not(.btn)');
  var spyTargets = navLinks
    .map(function (a) { return { link: a, section: $(a.getAttribute('href')) }; })
    .filter(function (t) { return t.section; });

  if ('IntersectionObserver' in window && spyTargets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var match = spyTargets.filter(function (t) { return t.section === entry.target; })[0];
        if (match) match.link.classList.toggle('is-current', entry.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    spyTargets.forEach(function (t) { spy.observe(t.section); });
  }


  /* ================================================== 3. Scroll reveals === */
  var revealEls = $$('.reveal');

  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    /* No observer support, or the visitor asked for less motion: show
       everything immediately. */
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        /* A small stagger makes a row of cards feel composed rather than
           snapping in all at once. */
        entry.target.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);   // one-shot: never re-hide on scroll up
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }


  /* ======================================== 4. Trust-bar count-up === */
  /* Reads the final value from data-count and counts up to it once the bar
     scrolls into view. data-prefix / data-suffix / data-decimals shape the
     output, so "$180M+" and "5.0★" both work. */
  function animateCount(el) {
    var target   = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix   = el.getAttribute('data-prefix') || '';
    var suffix   = el.getAttribute('data-suffix') || '';
    if (isNaN(target)) return;

    var duration = 1500;
    var start    = null;

    function frame(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);           // easeOutCubic
      var value = (target * eased).toFixed(decimals);
      el.textContent = prefix + Number(value).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var counters = $$('.trust-num');
  if (counters.length && 'IntersectionObserver' in window && !prefersReducedMotion) {
    var countObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }
  /* If the animation never runs, the static text already in the HTML stands. */


  /* ================================================= 5. Gallery filters === */
  var filterBtns = $$('.filter');
  var cards      = $$('#galleryGrid .card');
  var emptyMsg   = $('#galleryEmpty');

  function applyFilter(tag) {
    var shown = 0;

    cards.forEach(function (card) {
      var tags = (card.getAttribute('data-tags') || '').split(/\s+/);
      var match = tag === 'all' || tags.indexOf(tag) !== -1;
      if (match) shown++;

      if (prefersReducedMotion) {
        card.hidden = !match;
        return;
      }
      /* Fade out first, then remove from the grid, so the reflow isn't jarring. */
      card.classList.toggle('is-filtering', !match);
      if (match) {
        card.hidden = false;
      } else {
        setTimeout(function () {
          if (card.classList.contains('is-filtering')) card.hidden = true;
        }, 320);
      }
    });

    if (emptyMsg) emptyMsg.hidden = shown > 0;
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      applyFilter(btn.getAttribute('data-filter'));
    });
  });


  /* ======================================================= 6. Lightbox === */
  var lightbox = $('#lightbox');
  var lbImage  = $('#lbImage');
  var lbCap    = $('#lbCaption');
  var lbCount  = $('#lbCount');
  var lbPrev   = $('#lbPrev');
  var lbNext   = $('#lbNext');
  var lbClose  = $('#lbClose');

  var lbIndex   = 0;
  var lbOpener  = null;   // element to hand focus back to on close

  /* Only the cards currently visible in the grid are navigable, so the
     arrows respect the active filter. */
  function visibleCards() {
    return cards.filter(function (c) { return !c.hidden; });
  }

  function showSlide(i) {
    var list = visibleCards();
    if (!list.length) return;
    lbIndex = (i + list.length) % list.length;   // wrap around both ways

    var btn = $('.card-btn', list[lbIndex]);
    var img = $('img', btn);

    lbImage.src = btn.getAttribute('data-full') || img.src;
    lbImage.alt = img.alt;
    lbCap.textContent = btn.getAttribute('data-caption') || '';
    lbCount.textContent = (lbIndex + 1) + ' / ' + list.length;

    var multiple = list.length > 1;
    lbPrev.hidden = lbNext.hidden = !multiple;
    lbCount.hidden = !multiple;
  }

  function openLightbox(card, opener) {
    lbOpener = opener;
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
    showSlide(visibleCards().indexOf(card));
    requestAnimationFrame(function () { lightbox.classList.add('is-open'); });
    lbClose.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    var done = function () {
      lightbox.hidden = true;
      lbImage.src = '';          // release the full-size image from memory
      if (lbOpener) lbOpener.focus();
    };
    prefersReducedMotion ? done() : setTimeout(done, 300);
  }

  if (lightbox) {
    cards.forEach(function (card) {
      var btn = $('.card-btn', card);
      if (btn) btn.addEventListener('click', function () { openLightbox(card, btn); });
    });

    lbClose.addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', function () { showSlide(lbIndex - 1); });
    lbNext.addEventListener('click', function () { showSlide(lbIndex + 1); });

    /* Click the backdrop (but not the photo) to dismiss. */
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape')      closeLightbox();
      else if (e.key === 'ArrowLeft')  showSlide(lbIndex - 1);
      else if (e.key === 'ArrowRight') showSlide(lbIndex + 1);
      else if (e.key === 'Tab')        trapFocus(lightbox, e);
    });

    /* Swipe between photos on touch devices. */
    var touchX = null;
    lightbox.addEventListener('touchstart', function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) showSlide(lbIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }


  /* ======================================== 7. Click-to-load videos === */
  /* The iframe is only created on click. That keeps the YouTube/Vimeo player
     (roughly 1 MB of third-party JavaScript per embed) off the initial page
     load and makes it impossible for a video to autoplay with sound. */
  function playVideo(btn) {
      var provider = btn.getAttribute('data-provider');
      var id       = btn.getAttribute('data-id');

      var wrap = document.createElement('div');
      wrap.className = 'video-embed';

      /* Self-hosted file: play a local <video> (no third-party player). The
         file isn't fetched until this click, so it never weighs on page load. */
      if (provider === 'file') {
        var fsrc = btn.getAttribute('data-src');
        if (fsrc) {
          var v = document.createElement('video');
          v.src = fsrc;
          v.controls = true;
          v.autoplay = true;
          v.playsInline = true;
          v.setAttribute('playsinline', '');
          v.preload = 'auto';
          v.className = 'video-player';
          v.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Client testimonial video');
          wrap.appendChild(v);
          btn.parentNode.replaceChild(wrap, btn);
          v.focus();
          return;
        }
      }

      /* Guard for the handoff period: until a real video id is in the markup,
         show a friendly bilingual "coming soon" card (safe to ship) instead of
         loading a broken player. Replace data-id with the real id to go live. */
      if (!id || id.indexOf('PLACEHOLDER') !== -1) {
        var soonTitle = LANG === 'en' ? 'Video coming soon' : 'Video próximamente';
        var soonBody  = LANG === 'en'
          ? 'This testimonial will be added shortly.'
          : 'Este testimonio se añadirá muy pronto.';
        wrap.innerHTML =
          '<div class="video-missing"><strong>' + soonTitle + '</strong>' +
          '<span>' + soonBody + '</span></div>';
        btn.parentNode.replaceChild(wrap, btn);
        return;
      }

      var src = provider === 'vimeo'
        ? 'https://player.vimeo.com/video/' + encodeURIComponent(id) + '?autoplay=1&title=0&byline=0&portrait=0'
        : 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1';

      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = btn.getAttribute('aria-label') || 'Client testimonial video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('loading', 'lazy');
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';

      wrap.appendChild(iframe);
      btn.parentNode.replaceChild(wrap, btn);
      iframe.focus();
  }

  /* Delegated click so JSON-rendered video cards (§7c) also play. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.video') : null;
    if (btn) playVideo(btn);
  });


  /* ============================ 7c. Testimonial videos from data file === */
  /* The #tVideos strip is rendered from assets/data/testimonial-videos.json so
     Hector can add/remove videos without touching HTML. The static cards in the
     markup are the no-JS / fetch-failed fallback. An entry with no "src" shows
     as a plain photo (no play icon). Never invents client names (see the JSON). */
  (function renderVideos() {
    var strip = $('#tVideos');
    if (!strip || !window.fetch) return;
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    fetch('assets/data/testimonial-videos.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.videos) || !data.videos.length) return;
        strip.innerHTML = data.videos.map(function (v) {
          var capEs = v.caption_es || '';
          var capEn = v.caption_en || capEs;
          var labelEs = v.name ? (capEs + ' — ' + v.name) : capEs;
          var labelEn = v.name ? (capEn + ' — ' + v.name) : capEn;
          var altEs = 'Miniatura de video' + (capEs ? ': ' + capEs : '') + (v.name ? ' — ' + v.name : '');
          var altEn = 'Video thumbnail' + (capEn ? ': ' + capEn : '') + (v.name ? ' — ' + v.name : '');
          var cap = labelEs
            ? '<figcaption class="video-name" data-en="' + esc(labelEn) + '">' + esc(labelEs) + '</figcaption>'
            : '';
          var webp = String(v.poster || '').replace(/\.jpe?g$/i, '.webp');
          var img = '<picture><source srcset="' + esc(webp) + '" type="image/webp">' +
                    '<img src="' + esc(v.poster) + '" alt="' + esc(altEs) +
                    '" data-en-alt="' + esc(altEn) + '" loading="lazy"></picture>';
          if (v.src) {
            var ariaEs = 'Reproducir video' + (capEs ? ': ' + capEs : '');
            var ariaEn = 'Play video' + (capEn ? ': ' + capEn : '');
            return '<figure class="video-card">' +
              '<button class="video" type="button" data-provider="file" data-src="' + esc(v.src) + '"' +
              ' aria-label="' + esc(ariaEs) + '" data-en-aria-label="' + esc(ariaEn) + '">' +
              img + '<span class="video-play" aria-hidden="true"></span></button>' +
              cap + '</figure>';
          }
          /* No video source → plain photo, no play icon. */
          return '<figure class="video-card no-video">' + img + cap + '</figure>';
        }).join('');
        setLang(LANG);                               // translate the new nodes
        window.dispatchEvent(new Event('resize'));   // re-sync the film arrows
      })
      .catch(function () { /* keep the static fallback cards already in the HTML */ });
  })();


  /* ============================ 7b. Horizontal film strips === */
  /* Compact photo + video sliders that scroll sideways. The arrow buttons
     scroll the strip by about one-and-a-half items; native swipe/scroll works
     on touch. Clicking a photo opens the shared lightbox (wired in §6 via the
     #galleryGrid cards); clicking a video loads its player (§7). Arrows hide
     themselves when the strip isn't wide enough to scroll. */
  $$('.film-wrap').forEach(function (wrap) {
    var film = $('.film', wrap);
    if (!film) return;
    var prevBtn = $('.film-prev', wrap);
    var nextBtn = $('.film-next', wrap);

    function stepWidth() {
      var item = film.querySelector('.card, .video-card');
      var gap = 14;
      return (item ? item.getBoundingClientRect().width : 220) * 1.5 + gap;
    }
    if (prevBtn) prevBtn.addEventListener('click', function () {
      film.scrollBy({ left: -stepWidth(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      film.scrollBy({ left: stepWidth(), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });

    /* Hide the arrows when everything already fits (nothing to scroll). */
    function syncArrows() {
      var scrollable = film.scrollWidth - film.clientWidth > 4;
      if (prevBtn) prevBtn.hidden = !scrollable;
      if (nextBtn) nextBtn.hidden = !scrollable;
    }
    syncArrows();
    window.addEventListener('resize', syncArrows);
    window.addEventListener('load', syncArrows);
  })


  /* =========================================== 8. Lead form === */
  var form      = $('#leadForm');
  var thanks    = $('#formThanks');
  var submitBtn = $('#submitBtn');
  var formError = $('#formError');

  if (form) {

    /* Point the form at the right endpoint based on CONFIG.provider. This runs
       before any submit, so the no-JS fallback POST also lands correctly.
       (The 'function' path submits via fetch in JS, but if JS is disabled the
       form still posts to Netlify Forms, so we set that action as the floor.) */
    if (CONFIG.provider === 'formspree') {
      form.setAttribute('action', 'https://formspree.io/f/' + CONFIG.formspreeId);
    } else {
      form.setAttribute('action', CONFIG.netlifyAction);
    }

    /* ---- Lead attribution: fill the hidden fields so the CRM knows where each
       lead came from. Reads ?utm_* from the URL, the referrer, the page, and
       the active language (kept in sync with the ES/EN toggle). ---- */
    function setHidden(name, value) {
      var el = form.elements[name];
      if (el && !el.value) el.value = value || '';   // don't clobber real input
    }
    (function captureAttribution() {
      var params = new URLSearchParams(location.search);
      setHidden('page', location.href.split('#')[0]);
      setHidden('referrer', document.referrer || '');
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
        if (params.get(k)) setHidden(k, params.get(k));
      });
      if (form.elements.language) form.elements.language.value = LANG;
    })();
    /* Keep the language field current if the visitor toggles ES/EN. */
    onLangChange(function (lang) {
      if (form.elements.language) form.elements.language.value = lang;
    });

    /* Each rule's `key` points at a string in I18N_STRINGS, so the error shows
       in whichever language is active. */
    var RULES = {
      name: {
        test: function (v) { return v.trim().length >= 2; },
        key: 'err_name'
      },
      email: {
        /* Deliberately permissive. Strict email regexes reject valid addresses;
           the real check is whether the reply bounces. */
        test: function (v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); },
        key: 'err_email'
      },
      phone: {
        test: function (v) {
          var digits = v.replace(/\D/g, '');
          return digits.length >= CONFIG.phoneDigits.min &&
                 digits.length <= CONFIG.phoneDigits.max;
        },
        key: 'err_phone'
      },
      interest: {
        test: function (v) { return v !== ''; },
        key: 'err_interest'
      },
      timeline: {
        test: function (v) { return v !== ''; },
        key: 'err_timeline'
      },
      consent: {
        test: function (v, field) { return field.checked; },
        key: 'err_consent'
      }
    };

    /* ---- Conditional qualifier fields: show the ones that fit the chosen
       intent, hide and clear the rest so the lead carries no stale data. ---- */
    var interestSel = form.elements.interest;
    var condFields = $$('.cond', form);
    function updateConditionalFields() {
      var val = interestSel ? interestSel.value : '';
      condFields.forEach(function (wrap) {
        var when = (wrap.getAttribute('data-when') || '').split(',');
        var show = val && when.indexOf(val) !== -1;
        wrap.hidden = !show;
        if (!show) {
          // clear any inputs/selects inside a hidden conditional field
          $$('input, select, textarea', wrap).forEach(function (el) { el.value = ''; });
        }
      });
    }
    if (interestSel) {
      interestSel.addEventListener('change', updateConditionalFields);
      updateConditionalFields(); // set correct state on load
    }

    function fieldWrap(input) {
      return input.closest('.field');
    }

    function setError(input, message) {
      var wrap = fieldWrap(input);
      if (!wrap) return;
      var slot = $('.error', wrap);
      wrap.classList.toggle('has-error', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (slot) slot.textContent = message || '';
    }

    function validateField(input) {
      var rule = RULES[input.name];
      if (!rule) return true;
      var ok = rule.test(input.value, input);
      setError(input, ok ? '' : t(rule.key));   // t() = active-language string
      return ok;
    }

    /* Validate on blur, then live-correct on input once a field has errored —
       nagging someone mid-typing is the fastest way to lose a lead. */
    Object.keys(RULES).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      var eventName = (input.type === 'checkbox' || input.tagName === 'SELECT') ? 'change' : 'blur';
      input.addEventListener(eventName, function () { validateField(input); });
      input.addEventListener('input', function () {
        var wrap = fieldWrap(input);
        if (wrap && wrap.classList.contains('has-error')) validateField(input);
      });
    });

    /* Light formatting on US-length numbers. Anything longer (an international
       number) is left exactly as typed. */
    var phoneInput = form.elements.phone;
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        var d = phoneInput.value.replace(/\D/g, '').slice(0, 10);
        if (phoneInput.value.trim().charAt(0) === '+' || d.length !== phoneInput.value.replace(/\D/g, '').length) return;
        if (d.length > 6)      phoneInput.value = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
        else if (d.length > 3) phoneInput.value = '(' + d.slice(0, 3) + ') ' + d.slice(3);
        else if (d.length > 0) phoneInput.value = '(' + d;
      });
    }

    function showThanks() {
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();                     // move screen readers to the message
      /* Keep the confirmation in view on small screens. */
      thanks.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });

      /* Conversion tracking — fires ONLY if analytics were loaded after the
         visitor accepted cookies (see §10). No-ops otherwise. */
      if (window.gtag) window.gtag('event', 'generate_lead', { value: 1 });
      if (window.fbq)  window.fbq('track', 'Lead');
    }

    function setSending(sending) {
      submitBtn.disabled = sending;
      submitBtn.classList.toggle('is-sending', sending);
      $('.btn-text', submitBtn).textContent = sending ? t('sending') : t('submit');
    }

    /* The submit button label and any visible validation errors are generated
       by JS, so refresh them when the language changes. Also set the resting
       button label now, in case the page loaded in English. */
    if (!submitBtn.classList.contains('is-sending')) {
      $('.btn-text', submitBtn).textContent = t('submit');
    }
    onLangChange(function () {
      if (!submitBtn.classList.contains('is-sending')) {
        $('.btn-text', submitBtn).textContent = t('submit');
      }
      // Re-render any error that's currently visible, in the new language.
      Object.keys(RULES).forEach(function (name) {
        var input = form.elements[name];
        if (input && fieldWrap(input) && fieldWrap(input).classList.contains('has-error')) {
          validateField(input);
        }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formError.hidden = true;

      /* Honeypot: a human never sees this field, so anything in it is a bot.
         Show the thank-you anyway — a bot that thinks it succeeded doesn't
         come back and retry. */
      if (form.elements.company && form.elements.company.value !== '') {
        showThanks();
        return;
      }

      /* Validate everything, then focus the first problem. */
      var firstBad = null;
      Object.keys(RULES).forEach(function (name) {
        var input = form.elements[name];
        if (input && !validateField(input) && !firstBad) firstBad = input;
      });
      if (firstBad) {
        firstBad.focus();
        firstBad.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
        return;
      }

      setSending(true);

      /* Clean, name-stamped, UNIQUE subject. The timestamp keeps every alert's
         subject different so Gmail never threads leads together — and so Lofty's
         Gmail parser sees each one as a NEW email (and creates a new lead). */
      if (form.elements.subject) {
        var leadName = (form.elements.name.value || '').trim() || 'Website';
        var stamp = new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'
        });
        form.elements.subject.value = 'New Website Lead — ' + leadName + ' · ' + stamp;
      }

      if (IS_LOCAL) {
        console.warn(
          '[lead form] Local preview: skipping the network request.\n' +
          'Deploy the site to test real submissions — see README.md.'
        );
        setTimeout(function () { setSending(false); showThanks(); }, 600);
        return;
      }

      var data = new FormData(form);
      var request;

      if (CONFIG.provider === 'function') {
        /* Serverless handler → CRM webhook. Send JSON; the function validates
           again and forwards it (see netlify/functions/submit-lead.js). */
        var obj = {};
        data.forEach(function (v, k) { obj[k] = v; });
        request = fetch(CONFIG.functionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(obj)
        });
      } else if (CONFIG.provider === 'formspree') {
        request = fetch(form.getAttribute('action'), {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' }
        });
      } else {
        /* Netlify Forms expects url-encoded data posted to a static page on
           the same site, with form-name included. */
        request = fetch(CONFIG.netlifyAction, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(data).toString()
        });
      }

      request
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setSending(false);
          showThanks();
        })
        .catch(function (err) {
          setSending(false);
          formError.hidden = false;
          formError.innerHTML = t('send_error');   // active-language message
          console.error('[lead form] submit failed:', err);
        });
    });
  }


  /* ==================================================== 9. Footer year === */
  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();


  /* ---- Contact email from config → every [data-email] link/label (item 10). */
  (function applyContactEmail() {
    var email = CONFIG.contactEmail;
    if (!email) return;
    $$('[data-email]').forEach(function (el) {
      el.textContent = email;
      if (el.tagName === 'A') el.setAttribute('href', 'mailto:' + email);
    });
  })();


  /* ============================ 9b. About stats from data file === */
  /* Renders #aboutStats from assets/data/about.json. Only non-empty values show,
     so an empty config renders nothing — the honest default. HARD RULE: never
     invent years, counts, languages, specialties, or areas. */
  (function renderAboutStats() {
    var dl = $('#aboutStats');
    if (!dl || !window.fetch) return;
    var LABELS = {
      yearsInRealEstate: { es: 'Años en bienes raíces', en: 'Years in real estate' },
      languages:         { es: 'Idiomas',               en: 'Languages' },
      specialties:       { es: 'Especialidades',         en: 'Specialties' },
      areasServed:       { es: 'Zonas atendidas',        en: 'Areas served' },
      familiesHelped:    { es: 'Familias ayudadas',       en: 'Families helped' }
    };
    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    fetch('assets/data/about.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        if (!cfg) return;
        var html = Object.keys(LABELS).map(function (k) {
          var val = (cfg[k] || '').toString().trim();
          if (!val) return '';
          return '<div class="about-stat">' +
            '<dt data-en="' + esc(LABELS[k].en) + '">' + esc(LABELS[k].es) + '</dt>' +
            '<dd>' + esc(val) + '</dd></div>';
        }).join('');
        if (!html) return;                 // nothing filled → stays hidden
        dl.innerHTML = html;
        dl.hidden = false;
        setLang(LANG);
      })
      .catch(function () {});
  })();


  /* ============================ 10. Analytics (consent-gated) === */
  /* Loads GA4 and/or Meta Pixel ONLY when an ID is configured AND the visitor
     accepts cookies. No IDs → nothing loads and no banner appears. */
  (function analyticsConsent() {
    var cfg = CONFIG.analytics || {};
    if (!cfg.ga4Id && !cfg.metaPixelId) return;   // privacy default: do nothing

    function loadGA4(id) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', id, { anonymize_ip: true });
    }
    function loadPixel(id) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', id);
      window.fbq('track', 'PageView');
    }
    function loadAll() {
      if (cfg.ga4Id) loadGA4(cfg.ga4Id);
      if (cfg.metaPixelId) loadPixel(cfg.metaPixelId);
    }

    var choice = null;
    try { choice = localStorage.getItem('cookieConsent'); } catch (e) {}
    if (choice === 'accepted') { loadAll(); return; }
    if (choice === 'declined') { return; }

    var banner = $('#cookieBanner');
    if (!banner) { return; }
    banner.hidden = false;
    function decide(accepted) {
      try { localStorage.setItem('cookieConsent', accepted ? 'accepted' : 'declined'); } catch (e) {}
      banner.hidden = true;
      if (accepted) loadAll();
    }
    var a = $('#cookieAccept'), d = $('#cookieDecline');
    if (a) a.addEventListener('click', function () { decide(true); });
    if (d) d.addEventListener('click', function () { decide(false); });
  })();


  /* ============================================== scroll listener === */
  /* One passive listener, rAF-throttled, driving the header state. */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateHeader();
      ticking = false;
    });
  }, { passive: true });

  updateHeader();   // set the correct state on load (e.g. a reload mid-page)

})();
