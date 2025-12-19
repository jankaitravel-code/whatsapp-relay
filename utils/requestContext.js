const crypto = require("crypto");

function buildRequestContext({ from }) {
  return {
    requestId: crypto.randomUUID(),
    user: from
  };
}

module.exports = { buildRequestContext };
