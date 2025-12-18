/**
 * Intent Router
 * Decides which intent handler should process the message
 */

const handleFlightIntent = require("./flightIntent");
const handleGreetingIntent = require("./greetingIntent");
const handleResetIntent = require("./resetIntent");
const handleFallbackIntent = require("./fallbackIntent");

async function routeIntent(context) {
  const { text } = context;

  // Order matters
  if (handleResetIntent.canHandle(text)) {
    return handleResetIntent.handle(context);
  }

  if (handleGreetingIntent.canHandle(text)) {
    return handleGreetingIntent.handle(context);
  }

  if (handleFlightIntent.canHandle(text)) {
    return handleFlightIntent.handle(context);
  }

  return handleFallbackIntent.handle(context);
}

module.exports = {
  routeIntent
};
