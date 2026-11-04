/* ============================================================================
   Lead handler — Netlify serverless function (fallback forwarder)
   ----------------------------------------------------------------------------
   PRIMARY PATH: the site submits with CONFIG.provider = 'netlify', so the
   browser posts the lead straight to Netlify Forms. Netlify Forms then
     (a) sends the email notification to Hector, and
     (b) triggers submission-created.js, which creates the lead in Lofty CRM.
   That single pipe is cache-proof (works for any site-script version) and
   creates exactly one Lofty lead (no duplicates).

   THIS function only runs if a client is still configured for provider:'function'
   (e.g. an old cached page from when we briefly used it). To keep everything in
   the ONE pipe, it simply forwards the submission to Netlify Forms — it does NOT
   create the Lofty lead itself (submission-created.js is the single creator).
   ========================================================================== */

exports.handler = async function (event) {
  // CORS: same-origin, but answer preflight cleanly.
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

  // ---- Honeypot: a filled "company" field means a bot. Accept silently. ----
  if (data.company) return json(200, { ok: true });

  // ---- Server-side validation (mirror of the client rules) ----
  var errors = [];
  if (!data.name || String(data.name).trim().length < 2) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(data.email || '').trim())) errors.push('email');
  var digits = String(data.phone || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors.push('phone');
  if (!data.interest) errors.push('interest');
  if (errors.length) return json(422, { ok: false, errors: errors });

  // ---- Funnel to Netlify Forms. That fires the email notification AND triggers
  //      submission-created.js (which creates the Lofty lead). One pipe, no
  //      duplicates, no dependence on which script the browser cached. ----
  try {
    await postToNetlifyForms(data, event);
  } catch (err) {
    console.error('[submit-lead] Netlify Forms forward failed:', err);
    console.error('[submit-lead] lead (recover from logs):', JSON.stringify(data));
    return json(502, { ok: false, error: 'forward_failed' });
  }
  return json(200, { ok: true, forwarded: true, to: 'netlify-forms' });
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

/* Re-post the submission to the site as a Netlify Forms submission (url-encoded
   with form-name), which fires Netlify's email notification AND triggers
   submission-created.js. Best path for any client still posting here. */
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
