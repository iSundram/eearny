// Sliding-window rate limiter for Express routes (zero external dependencies).
// Uses X-Forwarded-For (reverse proxy safe) or socket remoteAddress, plus optional user ID.

const buckets = new Map();

// Clean up expired windows every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 120 * 1000).unref();

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ name = 'global', windowMs = 60 * 1000, max = 60, keyBy = 'ip', message } = {}) {
  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === '1') return next();
    const subject = keyBy === 'user' && req.user?.sub ? req.user.sub : clientIp(req);
    const key = `${name}:${subject}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    const remaining = Math.max(0, max - b.count);
    const retryAfterSec = Math.ceil((b.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(b.resetAt / 1000)));

    if (b.count > max) {
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: message || `Too many requests — please wait ${retryAfterSec}s and try again`,
        retryAfter: retryAfterSec,
      });
    }
    next();
  };
}

module.exports = { rateLimit, clientIp };
