async function start(context) {
  await context.sendWhatsAppMessage(
    context.from,
    "🚧 Multicity flights are not supported yet."
  );
}

async function handle(context) {
  await context.sendWhatsAppMessage(
    context.from,
    "🚧 Multicity flights are not supported yet."
  );
}

module.exports = { start, handle };
