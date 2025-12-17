/**
 * Centralized configuration
 * All required values must be provided via environment variables
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  whatsapp: {
    verifyToken: requireEnv("VERIFY_TOKEN"),
    accessToken: requireEnv("WHATSAPP_TOKEN"),
    phoneNumberId: requireEnv("PHONE_NUMBER_ID")
  },

  amadeus: {
    apiKey: requireEnv("AMADEUS_API_KEY"),
    apiSecret: requireEnv("AMADEUS_API_SECRET"),
    baseUrl: requireEnv("AMADEUS_BASE_URL")
  }
};

module.exports = config;
