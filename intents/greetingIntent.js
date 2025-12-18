/**
 * Greeting Intent
 */

function canHandle(text) {
  return /^(hi|hello|hey)$/i.test(text.trim());
}

async function handle({ from, sendWhatsAppMessage }) {
  await sendWhatsAppMessage(
    from,
    "Hello 👋 I’m your travel assistant.\nYou can say:\nflight DEL to DXB on 2025-12-25"
  );
}

module.exports = {
  canHandle,
  handle
};
