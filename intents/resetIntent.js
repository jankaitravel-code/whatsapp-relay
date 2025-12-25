/**
 * Reset Intent
 * Handles cancel / reset / start over commands
 */

function canHandle(text) {
  const normalized = text.trim().toLowerCase();

  return (
    normalized === "cancel" ||
    normalized === "reset" ||
    normalized === "start over"
  );
}

async function handle({ from, sendWhatsAppMessage, clearConversation }) {
  clearConversation(from);

  await sendWhatsAppMessage(
    from,
    "✅ All set. Let’s start fresh.\n\n" +
    "You can reply:\n delhi to mumbai"
  );
}

module.exports = {
  canHandle,
  handle
};
