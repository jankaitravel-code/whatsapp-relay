/**
 * Greeting Intent
 */

function canHandle(text) {
  const normalized = text.trim().toLowerCase();
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
    "Try:\nflight DEL to DXB on 2025-12-25"
  );
}

module.exports = {
  canHandle,
  handle
};
