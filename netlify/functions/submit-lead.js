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
   Site configuration → Environment variables → Add a variable:
       Key:   LEAD_WEBHOOK_URL
       Value: your CRM's inbound webhook URL
              (Zapier/Make "Catch Hook" URL, Go High Level inbound webhook,
               Follow Up Boss/HubSpot via Zapier, an Airtable automation, etc.)
   Redeploy. That's it — every lead is forwarded there as JSON.

   The JSON shape sent to the webhook is documented at the bottom of this file.
   Until LEAD_WEBHOOK_URL is set, leads are accepted (the visitor still sees the
   thank-you) and logged in the function logs, but NOT forwarded — so set it
   before you rely on it. See README §3 for the full walkthrough.
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

  // ---- Forward to the CRM webhook ----
  var webhook = process.env.LEAD_WEBHOOK_URL;
  if (!webhook) {
    // Not configured yet: don't break the visitor's experience, but make it
    // loud in the logs so it isn't missed. The lead object is logged so it can
    // be recovered from Netlify's function logs if needed.
    console.warn('[submit-lead] LEAD_WEBHOOK_URL is not set — lead NOT forwarded.');
    console.warn('[submit-lead] lead:', JSON.stringify(payload));
    return json(200, { ok: true, forwarded: false });
  }

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
    return json(502, { ok: false, error: 'forward_failed' });
  }

  return json(200, { ok: true, forwarded: true });
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
