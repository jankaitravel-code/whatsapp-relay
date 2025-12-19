/**
 * Rate Limiter – Scaffold (log-only)
 * No blocking, no side effects
 */

const buckets = new Map();

function checkRateLimit({
  user,
  limit = 20,
  windowMs = 60_000
}) {
  const now = Date.now();
  const bucket = buckets.get(user) || [];

  const recent = bucket.filter(ts => now - ts < windowMs);
  recent.push(now);

  buckets.set(user, recent);

  return {
    allowed: recent.length <= limit,
    count: recent.length,
    limit,
    windowMs
  };
}

module.exports = {
  checkRateLimit
};
