/**
 * Centralized configuration
 * (Temporary defaults included for backward compatibility)
 */

const config = {
  whatsapp: {
    verifyToken: process.env.VERIFY_TOKEN,
    accessToken:
      process.env.WHATSAPP_TOKEN ||
      "EAFoqwCGEN2oBQFnIXZCtXh3t8sGX2pulg0YZAlcJfB31GvJU3Rp8ynlct3yNCgZCHQfuDwJoQ16pKwvPcKFV5i8CYWrVLwpoX8dvKGvmhXCwaxNlS4wc0w34jCwooZAUo4xe6AdyobVWmoU36MdtBmIRZAAoPFFuHAtnasF4SjSIKSxRmeYxbz6bGQcRJBgOEZA5Hl9JZBdGq5dorvIHbhKEpa5ZCxDICB16eIDRZA3pNxBREPZAZCxx3OSXldzar3ZBg7sUCrlBhqW2suzTA4LDgy3sRV0VLS6ZCHyabey9l",
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

