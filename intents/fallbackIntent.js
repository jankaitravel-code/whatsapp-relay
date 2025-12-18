/**
 * Fallback Intent (stub)
 * Will be implemented later
 */

function canHandle() {
  return true; // fallback always catches
}

async function handle(context) {
  const { from, sendWhatsAppMessage } = context;

  await sendWhatsAppMessage(
    from,
    "I can help with flights.\nTry:\nflight DEL to DXB on 2025-12-25"
  );
}

module.exports = {
  canHandle,
  handle
};
