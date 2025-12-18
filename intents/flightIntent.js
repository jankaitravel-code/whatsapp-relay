/**
 * Flight Intent
 * Delegates to existing flight handling logic
 */

function canHandle(text) {
  if (!text) return false;
  return text.toLowerCase().includes("flight");
}

async function handle(context) {
  // IMPORTANT:
  // Do nothing here yet.
  // Let server.js handle flight logic as before.
  return false;
}

module.exports = {
  canHandle,
  handle
};
