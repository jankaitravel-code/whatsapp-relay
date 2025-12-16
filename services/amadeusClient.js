/**
 * Amadeus API Client (Test Environment)
 * This module ONLY talks to Amadeus.
 * No WhatsApp or user logic must live here.
 */

const axios = require("axios");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

let accessToken = null;
let tokenExpiry = null;

/**
 * Fetch and cache OAuth token from Amadeus
 */
async function getAccessToken() {
  // Reuse token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  console.log("🔐 Fetching new Amadeus access token");

  const response = await axios.post(
    `${AMADEUS_BASE_URL}/v1/security/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: "wSAAIVyw13GQjZK9gduD1xLMKpsUMKNZ",
      client_secret: "HFRZHFYk22TIPDHD"
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  accessToken = response.data.access_token;
  tokenExpiry = Date.now() + response.data.expires_in * 1000;

  return accessToken;
}
async function testConnection() {
  try {
    const token = await getAccessToken();
    console.log("✅ Amadeus token fetched successfully");
    return token;
  } catch (err) {
    console.error(
      "❌ Amadeus connection failed",
      err.response?.data || err.message
    );
    throw err;
  }
}
module.exports = {
  getAccessToken,
  testConnection
};
