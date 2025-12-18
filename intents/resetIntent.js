/**
 * Reset Intent
 * Handles cancel / reset / start over commands
 */

function canHandle(text) {
  return (
    text === "cancel" ||
    text === "reset" ||
    text === "start over"
  );
}

async function handle(context) {
  const { from, sendWhatsAppMessage, clearConversation } = context;

  clearConversation(from);

  await sendWhatsAppMessage(
    from,
    "✅ All set. Let’s start fresh.\nYou can say:\nflight DEL to DXB on 2025-12-25"
  );
}

module.exports = {
  canHandle,
  handle
};
