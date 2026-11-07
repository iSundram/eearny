// Client-side device fingerprint for eearny.
// Collects coarse, non-identifying device traits and hashes them into a short
// fingerprint so sessions can be recognised in "Devices & sessions".
// No cookies, no storage, no network calls — just what the browser already sends.

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Unknown browser';
}

function detectOS(ua) {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

// djb2 → hex string (stable across reloads, cheap, no deps)
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

function canvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = '#6D74C4';
    ctx.fillRect(0, 0, 200, 40);
    ctx.fillStyle = '#1A1D24';
    ctx.fillText('eearny · fp', 4, 8);
    ctx.strokeStyle = 'rgba(121,182,153,.8)';
    ctx.arc(100, 20, 14, 0, Math.PI * 2);
    ctx.stroke();
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

export function collectDevice() {
  const nav = navigator;
  const ua = nav.userAgent || '';
  const traits = {
    userAgent: ua,
    screen: `${window.screen.width}x${window.screen.height}`,
    depth: window.screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    language: nav.language || '',
    languages: (nav.languages || []).join(','),
    platform: nav.platform || '',
    hardwareConcurrency: nav.hardwareConcurrency || 0,
    deviceMemory: nav.deviceMemory || 0,
    touchPoints: nav.maxTouchPoints || 0,
    canvas: canvasFingerprint(),
  };
  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    deviceType: /Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'mobile' : 'desktop',
    screen: traits.screen,
    timezone: traits.timezone,
    language: traits.language,
    fingerprint: hash(JSON.stringify(traits)),
  };
}
