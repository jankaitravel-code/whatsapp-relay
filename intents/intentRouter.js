/**
 * Intent Router
 * Decides which intent handler should process the message
 */

const handleResetIntent = require("./resetIntent");
const handleGreetingIntent = require("./greetingIntent");
const handleFlightIntent = require("./flightIntent");
const handleFallbackIntent = require("./fallbackIntent");
async function routeIntent(context) {
  const { text } = context;

  if (handleResetIntent.canHandle(text)) {
    await handleResetIntent.handle(context);
    return true;
  }

  if (handleGreetingIntent.canHandle(text)) {
    await handleGreetingIntent.handle(context);
    return true;
  }

  if (handleFlightIntent.canHandle(text)) {
    await handleFlightIntent.handle(context);
    return true;
  }

  await handleFallbackIntent.handle(context);
  return true;
}

module.exports = {
  routeIntent
};
