// Rough user-agent parsing for session/device display purposes.
// The precise fingerprint comes from the client (frontend/packages/fingerprint.js);
// this is only the server-side fallback when the client doesn't send one.

function parseUserAgent(ua = '') {
  const s = String(ua);
  let browser = 'Unknown browser';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\//.test(s)) browser = 'Opera';
  else if (/Chrome\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';
  else if (/Firefox\//.test(s)) browser = 'Firefox';

  let os = 'Unknown OS';
  if (/Windows NT/.test(s)) os = 'Windows';
  else if (/Android/.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
  else if (/Mac OS X/.test(s)) os = 'macOS';
  else if (/Linux/.test(s)) os = 'Linux';

  const deviceType = /Mobi|Android|iPhone|iPad|iPod/.test(s) ? 'mobile' : 'desktop';

  return { browser, os, deviceType };
}

// Merge the client-reported device payload with request-derived facts.
function normalizeDevice(bodyDevice = {}, req) {
  const fromUa = parseUserAgent(req.headers['user-agent']);
  const d = bodyDevice && typeof bodyDevice === 'object' ? bodyDevice : {};
  return {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
    browser: typeof d.browser === 'string' && d.browser ? d.browser : fromUa.browser,
    os: typeof d.os === 'string' && d.os ? d.os : fromUa.os,
    deviceType: typeof d.deviceType === 'string' && d.deviceType ? d.deviceType : fromUa.deviceType,
    screen: typeof d.screen === 'string' ? d.screen : null,
    timezone: typeof d.timezone === 'string' ? d.timezone : null,
    language: typeof d.language === 'string' ? d.language : null,
    // stored as a short hash only — never raw tracking data
    fingerprint: typeof d.fingerprint === 'string' ? d.fingerprint.slice(0, 16) : null,
  };
}

module.exports = { parseUserAgent, normalizeDevice };
