/* ============================================================================
   submission-created — Netlify form-submission trigger
   ----------------------------------------------------------------------------
   The filename is special: Netlify invokes this function AUTOMATICALLY on every
   verified form submission (no wiring needed). This is now the SINGLE place a
   website lead becomes a Lofty CRM lead — so a lead reaches Lofty no matter how
   the form was submitted (any site script version, any browser cache state),
   and exactly once (no duplicates). The email to Hector is sent separately by
   Netlify Forms' own notification.

   Needs LOFTY_API_TOKEN (Netlify env var). If it's missing or Lofty rejects the
   lead, we log loudly and return 200 — the submission is still saved under
   Site → Forms, so nothing is ever lost.
   ========================================================================== */

var lofty = require('./lib/lofty');

exports.handler = async function (event) {
  var token = process.env.LOFTY_API_TOKEN;
  if (!token) {
    console.warn('[submission-created] LOFTY_API_TOKEN not set — lead saved in Forms only.');
    return { statusCode: 200, body: 'no token' };
  }

  var sub;
  try {
    sub = JSON.parse(event.body || '{}');
  } catch (e) {
    console.error('[submission-created] could not parse body:', e);
    return { statusCode: 200, body: 'bad body' };
  }

  var p = sub.payload || {};
  var data = p.data || {};
  var formName = p.form_name || data['form-name'] || '';

  // Only handle the lead form; ignore any other forms on the site.
  if (formName && formName !== 'lead') {
    return { statusCode: 200, body: 'ignored form: ' + formName };
  }
  // Honeypot: a filled "company" field means a bot.
  if (data.company) return { statusCode: 200, body: 'honeypot' };
  // Minimal sanity — Netlify already validated it's a real submission.
  if (!data.name || !data.email || !data.phone) {
    console.warn('[submission-created] missing required fields:', JSON.stringify(data));
    return { statusCode: 200, body: 'missing fields' };
  }

  var payload = lofty.buildPayloadFromForm(data);
  try {
    await lofty.postToLofty(payload, token);
  } catch (err) {
    console.error('[submission-created] Lofty create-lead failed:', err);
    console.error('[submission-created] lead (safe in Netlify Forms + logs):', JSON.stringify(payload));
    return { statusCode: 200, body: 'lofty failed (logged)' };
  }
  return { statusCode: 200, body: 'ok' };
};
