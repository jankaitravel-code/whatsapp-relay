/**
 * Structured Logger (production-safe)
 */

function log(event, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...payload
  };

  console.log(JSON.stringify(entry));
}

module.exports = { log };
