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
    "Hi 👋 I’m Jank.ai, your travel assistant.\n\n" +
    "Currently, I can help you find flights. Try replying:\n" +
    "Flights"
  );
}

module.exports = {
  canHandle,
  handle
};
