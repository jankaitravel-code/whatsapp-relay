/**
 * Abuse Signal Collector (log-only)
 */

const { log } = require("./logger");

function recordSignal(type, payload) {
  log("abuse_signal", {
    type,
    ...payload
  });
}

module.exports = {
  recordSignal
};
