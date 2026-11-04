/* ============================================================================
   Lead handler — Netlify serverless function
   ----------------------------------------------------------------------------
   The browser form POSTs here (see CONFIG.provider = 'function' in script.js).
   This function:
     1. Re-validates every field server-side (never trust the client).
     2. Drops bot submissions caught by the honeypot.
     3. Forwards a clean, CRM-ready JSON payload to your webhook.

   WHY A FUNCTION INSTEAD OF POSTING THE CRM DIRECTLY FROM THE BROWSER:
   a CRM/webhook often needs an API key or secret URL. Anything in the
   browser is public. This function runs on Netlify's server, so the secret
   lives in an environment variable the public never sees.

   ── SETUP (one time, in the Netlify dashboard) ──────────────────────────────
   Site configuration → Environment variables → add ONE of these, then redeploy:

     PREFERRED — straight into Lofty CRM (no Zapier, no email parsing):
       Key:   LOFTY_API_TOKEN
       Value: a Lofty API key — generate at Settings → Integrations → API with
              ADD permission on the Leads resource. (Sent as "Authorization:
              token <KEY>"; for an OAuth access token instead, also set
              LOFTY_AUTH_SCHEME=Bearer.)
       Every lead is POSTed to https://api.lofty.com/v1.0/leads with the full
       qualifier set, tagged "Website", source "Website – hectorbelenrealtor.com",
       and leadAlert:true so Lofty fires its own new-lead email + phone push.
       All the extra detail (budget, timeline, area, financing, message, UTM)
       lands in the lead's first note. See buildLoftyLead() below.

     FALLBACK — a generic JSON webhook (Zapier/Make Catch Hook, Go High Level…):
       Key:   LEAD_WEBHOOK_URL
       Value: the inbound webhook URL. The payload shape is at the bottom here.

   If LOFTY_API_TOKEN is set it wins; else LEAD_WEBHOOK_URL is used. Until one is
   set, leads are accepted (the visitor still sees the thank-you) and logged in
   the function logs, but NOT delivered — so set one before you rely on it.
   See README §3 and LOFTY-SEARCH-SETUP.md.
   ========================================================================== */

exports.handler = async function (event) {
  // CORS: same-origin only, but answer preflight cleanly just in case.
  if (event.httpMethod === 'OPTIONS') return resp(204, '');
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  // ---- Parse body (accept JSON or url-encoded) ----
  var data = {};
  try {
    var ct = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    if (ct.indexOf('application/json') !== -1) {
      data = JSON.parse(event.body || '{}');
    } else {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
    }
  } catch (e) {
    return json(400, { ok: false, error: 'bad_request' });
  }

  // ---- Honeypot: a filled "company" field means a bot. Accept silently so it
  //      doesn't retry, but don't forward. ----
  if (data.company) return json(200, { ok: true });

  // ---- Server-side validation (mirror of the client rules) ----
  var errors = [];
  if (!data.name || String(data.name).trim().length < 2) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(data.email || '').trim())) errors.push('email');
  var digits = String(data.phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors.push('phone');
  if (!data.interest) errors.push('interest');
  if (errors.length) return json(422, { ok: false, errors: errors });

  // ---- Clean, CRM-ready payload ----
  var payload = {
    name: String(data.name).trim(),
    email: String(data.email).trim(),
    phone: String(data.phone).trim(),
    interest: String(data.interest),
    // Qualifier fields (optional — present depending on intent):
    timeline: String(data.timeline || ''),
    contactMethod: String(data.contact_method || ''),
    propertyAddress: String(data.property_address || ''),
    area: String(data.area || ''),
    budget: String(data.budget || ''),
    bedrooms: String(data.bedrooms || ''),
    financing: String(data.financing || ''),
    message: String(data.message || '').trim(),
    consent: data.consent === 'yes' || data.consent === true || data.consent === 'on',
    language: data.language === 'en' ? 'en' : 'es',
    source: String(data.source || 'website'),
    page: String(data.page || ''),
    referrer: String(data.referrer || ''),
    utm: {
      source: String(data.utm_source || ''),
      medium: String(data.utm_medium || ''),
      campaign: String(data.utm_campaign || ''),
      term: String(data.utm_term || ''),
      content: String(data.utm_content || '')
    },
    submittedAt: new Date().toISOString()
  };

  // ---- Independent EMAIL alert (best effort) --------------------------------
  //      Lofty's own lead emails are unreliable on this account, so fire a
  //      second, independent notification through Netlify Forms (Netlify's own
  //      mail — separate from Lofty entirely). The lead is also recorded under
  //      Site → Forms as a backup log. Never blocks or fails the submission.
  //      Turn off by setting LEAD_EMAIL_NOTIFY = 'off' in Netlify. ----
  var emailed = false;
  if (process.env.LEAD_EMAIL_NOTIFY !== 'off') {
    try {
      await postToNetlifyForms(data, event);
      emailed = true;
    } catch (e) {
      console.error('[submit-lead] Netlify Forms email notify failed (non-fatal):', e);
    }
  }

  // ---- Deliver the lead. Lofty CRM (direct API) wins; a generic JSON webhook
  //      is the fallback. If neither is configured, log loudly so nothing is
  //      silently lost (recoverable from Netlify's function logs). ----
  var loftyToken = process.env.LOFTY_API_TOKEN;
  var webhook    = process.env.LEAD_WEBHOOK_URL;

  if (loftyToken) {
    try {
      await postToLofty(payload, loftyToken);
    } catch (err) {
      console.error('[submit-lead] Lofty create-lead failed:', err);
      console.error('[submit-lead] lead (not lost — recover from logs):', JSON.stringify(payload));
      return json(502, { ok: false, error: 'lofty_failed', emailed: emailed });
    }
    return json(200, { ok: true, forwarded: true, to: 'lofty', emailed: emailed });
  }

  if (webhook) {
    try {
      var res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('webhook responded ' + res.status);
    } catch (err) {
      console.error('[submit-lead] webhook forward failed:', err);
      console.error('[submit-lead] lead (not lost — recover from logs):', JSON.stringify(payload));
      return json(502, { ok: false, error: 'forward_failed', emailed: emailed });
    }
    return json(200, { ok: true, forwarded: true, to: 'webhook', emailed: emailed });
  }

  console.warn('[submit-lead] No LOFTY_API_TOKEN or LEAD_WEBHOOK_URL set — lead NOT delivered.');
  console.warn('[submit-lead] lead:', JSON.stringify(payload));
  return json(200, { ok: true, forwarded: false });
};

function resp(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    body: body
  };
}
function json(statusCode, obj) {
  var r = resp(statusCode, JSON.stringify(obj));
  r.headers['Content-Type'] = 'application/json';
  return r;
}

/* ── Independent email alert via Netlify Forms ────────────────────────────────
   Re-posts the submission to the site as a Netlify Forms submission (url-encoded
   with form-name), which fires Netlify's own email notification — reliable mail
   that does NOT depend on Lofty. The lead is also stored under Site → Forms as a
   backup. Requires the "lead" form's email notification to be enabled in
   Netlify → Forms → Settings & notifications. Best effort; never blocks a lead. */
async function postToNetlifyForms(data, event) {
  var hdrs = event.headers || {};
  var host = hdrs.host || hdrs.Host || 'hectorbelenrealtor.com';
  var body = new URLSearchParams();
  body.set('form-name', data['form-name'] || 'lead');
  Object.keys(data).forEach(function (k) {
    if (k === 'form-name') return;
    if (data[k] == null) return;
    body.set(k, String(data[k]));
  });
  var res = await fetch('https://' + host + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) throw new Error('Netlify Forms responded ' + res.status);
  return true;
}

/* ── Lofty CRM: create a lead directly via the REST API ───────────────────────
   Docs: https://developer.lofty.com/api-reference/leads/create-lead
   Maps the site's qualifier payload to Lofty's lead schema. The full detail
   (budget, timeline, area, financing, message, UTM, page) goes into the lead's
   first note via `content`. `leadAlert:true` makes Lofty fire its own new-lead
   email + phone push, so Hector is notified; `welcomeEmail:false` means the
   lead is NOT auto-emailed — Hector reaches out personally. With no
   assignedUserId, Lofty's routing assigns the lead (the solo agent) by default.
   ──────────────────────────────────────────────────────────────────────────── */
var LOFTY_LEADS_URL = 'https://api.lofty.com/v1.0/leads';

var LOFTY_LEAD_TYPE = {   /* our `interest` → Lofty leadTypes ids */
  Buying: [2], Selling: [1], Renting: [5], BuyingSelling: [1, 2], HomeValue: [1]
};
var LOFTY_TIMEFRAME = {   /* our `timeline` → Lofty *TimeFrame enum */
  'ASAP': '1-3', '1-3 months': '1-3', '3-6 months': '3-6',
  '6-12 months': '6-12', 'Just exploring': 'Just Looking'
};

function buildLoftyLead(p) {
  var parts = String(p.name).trim().split(/\s+/);
  var firstName = parts.shift() || String(p.name).trim();
  var lastName  = parts.join(' ');

  var isSeller = p.interest === 'Selling' || p.interest === 'HomeValue' || p.interest === 'BuyingSelling';
  var isBuyer  = p.interest === 'Buying'  || p.interest === 'Renting'   || p.interest === 'BuyingSelling';
  var tf = LOFTY_TIMEFRAME[p.timeline] || '';

  var lead = {
    firstName: firstName,
    lastName:  lastName,
    emails:    p.email ? [p.email] : [],
    phones:    p.phone ? [p.phone] : [],
    leadTypes: LOFTY_LEAD_TYPE[p.interest] || [-1],
    source:    'Website – hectorbelenrealtor.com',
    language:  p.language === 'en' ? 'en' : 'es',
    tagsAdd:   ['Website'],
    content:   loftyNote(p),
    isPin:     false,
    leadAlert: true,
    welcomeEmail: false
  };
  if (tf && isBuyer)  lead.buyingTimeFrame  = tf;
  if (tf && isSeller) lead.sellingTimeFrame = tf;
  if (p.financing === 'Pre-approved' || p.financing === 'Cash') lead.preQual = 'Yes';
  else if (p.financing === 'Not yet' || p.financing === 'Needs help') lead.preQual = 'No';
  return lead;
}

function loftyNote(p) {
  var L = ['Website lead — hectorbelenrealtor.com'];
  if (p.interest)        L.push('Interest: ' + p.interest);
  if (p.timeline)        L.push('Timeline: ' + p.timeline);
  if (p.contactMethod)   L.push('Preferred contact: ' + p.contactMethod);
  if (p.area)            L.push('Area: ' + p.area);
  if (p.budget)          L.push('Budget: ' + p.budget);
  if (p.bedrooms)        L.push('Bedrooms: ' + p.bedrooms);
  if (p.financing)       L.push('Financing: ' + p.financing);
  if (p.propertyAddress) L.push('Property: ' + p.propertyAddress);
  if (p.message)         L.push('Message: ' + p.message);
  L.push('TCPA consent: ' + (p.consent ? 'Yes' : 'No'));
  if (p.page)            L.push('Page: ' + p.page);
  if (p.referrer)        L.push('Referrer: ' + p.referrer);
  var utm = p.utm || {};
  if (utm.source || utm.medium || utm.campaign) {
    L.push('UTM: ' + [utm.source, utm.medium, utm.campaign].filter(Boolean).join(' / '));
  }
  if (p.submittedAt)     L.push('Submitted: ' + p.submittedAt);
  return L.join('\n').slice(0, 2000);
}

async function postToLofty(p, token) {
  // Auth scheme differs by credential type:
  //   • self-serve API key (Settings → Integrations → API)  → "token <KEY>"
  //   • OAuth 2.0 access token                               → "Bearer <TOKEN>"
  // Default to "token" (the API-key path). Override with LOFTY_AUTH_SCHEME=Bearer
  // for OAuth, or just put the full value (e.g. "Bearer abc...") in the env var.
  var auth = /\s/.test(token.trim())
    ? token.trim()
    : (process.env.LOFTY_AUTH_SCHEME || 'token') + ' ' + token.trim();
  var res = await fetch(LOFTY_LEADS_URL, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildLoftyLead(p))
  });
  if (!res.ok) {
    var body = '';
    try { body = await res.text(); } catch (e) {}
    throw new Error('Lofty responded ' + res.status + ' ' + body.slice(0, 300));
  }
  return true;
}

/* ── WEBHOOK PAYLOAD SHAPE ────────────────────────────────────────────────────
   {
     "name": "María González",
     "email": "maria@example.com",
     "phone": "(407) 555-0142",
     "interest": "Buying",             // Buying | Selling | Renting | BuyingSelling | HomeValue (language-independent)
     "timeline": "1-3 months",         // ASAP | 1-3 months | 3-6 months | 6-12 months | Just exploring
     "contactMethod": "WhatsApp",      // Call | Text | WhatsApp | Email | "" (no preference)
     "propertyAddress": "",            // sellers / valuation only
     "area": "Kissimmee, Lake Nona",   // buyers / renters only
     "budget": "$350,000",             // buyers / renters only
     "bedrooms": "3+",                 // buyers / renters only
     "financing": "Pre-approved",      // buyers only — Pre-approved | Not yet | Cash | Needs help
     "message": "Flexible on move-in",
     "consent": true,
     "language": "es",                 // "es" or "en" — which site language they used
     "source": "website",
     "page": "https://hectorbelenrealtor.com/",
     "referrer": "https://www.facebook.com/",
     "utm": { "source": "fb", "medium": "cpc", "campaign": "spring", "term": "", "content": "" },
     "submittedAt": "2026-10-14T18:30:00.000Z"
   }
   Map these fields to your CRM in Zapier/Make, or point LEAD_WEBHOOK_URL at a
   CRM that accepts raw JSON (Go High Level inbound webhook, etc.).
   ──────────────────────────────────────────────────────────────────────────── */
