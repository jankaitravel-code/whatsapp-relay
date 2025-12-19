/**
 * Greeting Intent
 */

function canHandle(text, context) {
  const normalized = text.trim().toLowerCase();

  // Do not interrupt active conversations
  if (context?.conversation) return false;

  return (
    normalized === "hi" ||
    normalized === "hello" ||
    normalized === "hey"
  );
}

async function handle({ from, sendWhatsAppMessage }) {
  await sendWhatsAppMessage(
    from,
    "Hello 👋 I’m your travel assistant.\n\n" +
    "I can help you find flights.\n" +
    "Try:\nflight from Delhi to Mumbai on 2025-12-25"
  );
}

module.exports = {
  canHandle,
  handle
};
