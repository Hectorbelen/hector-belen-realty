/* ============================================================================
   Lofty CRM helpers (shared)
   ----------------------------------------------------------------------------
   Used by submission-created.js to create a lead in Lofty from the site's form
   fields. Kept in lib/ so it is bundled as a dependency, not deployed as its own
   Netlify function. Auth + field mapping live here so there is ONE source of
   truth for how a website lead becomes a Lofty lead.
   ========================================================================== */

var LOFTY_LEADS_URL = 'https://api.lofty.com/v1.0/leads';

var LOFTY_LEAD_TYPE = {   /* our `interest` → Lofty leadTypes ids */
  Buying: [2], Selling: [1], Renting: [5], BuyingSelling: [1, 2], HomeValue: [1]
};
var LOFTY_TIMEFRAME = {   /* our `timeline` → Lofty *TimeFrame enum */
  'ASAP': '1-3', '1-3 months': '1-3', '3-6 months': '3-6',
  '6-12 months': '6-12', 'Just exploring': 'Just Looking'
};

/* Map the raw submitted form fields (snake_case, as they arrive from the form /
   Netlify Forms submission) into the internal payload buildLoftyLead expects. */
function buildPayloadFromForm(d) {
  d = d || {};
  return {
    name: String(d.name || '').trim(),
    email: String(d.email || '').trim(),
    phone: String(d.phone || '').trim(),
    interest: String(d.interest || ''),
    timeline: String(d.timeline || ''),
    contactMethod: String(d.contact_method || ''),
    propertyAddress: String(d.property_address || ''),
    area: String(d.area || ''),
    budget: String(d.budget || ''),
    bedrooms: String(d.bedrooms || ''),
    financing: String(d.financing || ''),
    message: String(d.message || '').trim(),
    consent: d.consent === 'yes' || d.consent === 'on' || d.consent === true,
    language: d.language === 'en' ? 'en' : 'es',
    source: String(d.source || 'website'),
    page: String(d.page || ''),
    referrer: String(d.referrer || ''),
    utm: {
      source: String(d.utm_source || ''),
      medium: String(d.utm_medium || ''),
      campaign: String(d.utm_campaign || ''),
      term: String(d.utm_term || ''),
      content: String(d.utm_content || '')
    },
    submittedAt: new Date().toISOString()
  };
}

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
    source:    'Website',
    language:  p.language === 'en' ? 'en' : 'es',
    tagsAdd:   ['Website', 'hectorbelenrealtor.com'],
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
  var L = ['SOURCE: Hector\'s website (hectorbelenrealtor.com) contact form'];
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
  // Self-serve API keys authenticate as "token <KEY>"; OAuth uses "Bearer".
  // Default to "token"; override with LOFTY_AUTH_SCHEME, or pass a full value.
  var auth = /\s/.test(token.trim())
    ? token.trim()
    : (process.env.LOFTY_AUTH_SCHEME || 'token') + ' ' + token.trim();
  var res = await fetch(LOFTY_LEADS_URL, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildLoftyLead(p))
  });
  if (!res.ok) {
    var body = '';
    try { body = await res.text(); } catch (e) {}
    throw new Error('Lofty responded ' + res.status + ' ' + body.slice(0, 300));
  }
  return true;
}

module.exports = { buildPayloadFromForm: buildPayloadFromForm, buildLoftyLead: buildLoftyLead, loftyNote: loftyNote, postToLofty: postToLofty };
