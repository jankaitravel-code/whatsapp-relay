/**
 * Centralized configuration
 * (Temporary defaults included for backward compatibility)
 */

const config = {
  whatsapp: {
    verifyToken: process.env.VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.PHONE_NUMBER_ID
  },

  amadeus: {
    apiKey: process.env.AMADEUS_API_KEY || "",
    apiSecret: process.env.AMADEUS_API_SECRET || "",
    baseUrl:
      process.env.AMADEUS_BASE_URL ||
      "https://test.api.amadeus.com"
  }
};

module.exports = config;

