/**
 * Centralized configuration
 * (Temporary defaults included for backward compatibility)
 */

const config = {
  whatsapp: {
    verifyToken: process.env.VERIFY_TOKEN || "my_verify_token_123",
    accessToken:
      process.env.WHATSAPP_TOKEN ||
      "EAFoqwCGEN2oBQDXB0bZAha63ejWig1FZBcZAMim0sGcCiYZAEy1RjZAKSamQ3zmkhSPBUvJrT7JdyAZBC68oLzZCqZA7pDBhNfGZCYulvnaAZAHZBGdqRJz2VSBwS8hQ4GQAy4vAYupMp5l21CnxpeoB1um8KB47Nc5rpAl5FeD9bcrMfLwXUURdAWXO4KiSYL7SgFPZB6VkKXSKjqfiSJsVBGCfpXrofZCKKWGxLy0BW4wdUyzcLXb17IKn77ROCi7FM0FJrHVj8MRzEo0x9cIOxDmzqiQ3YPPIA8epwbAZDZD",
    phoneNumberId:
      process.env.PHONE_NUMBER_ID || "948142088373793"
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

