/**
 * Location Service
 * Resolves city names to IATA airport/city codes using Amadeus
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

// Simple in-memory cache (safe for now)
const locationCache = {};

async function resolveLocation(query) {
  const key = query.toLowerCase();

  if (locationCache[key]) {
    return locationCache[key];
  }

  const token = await getAccessToken();

  const response = await axios.get(
    `${AMADEUS_BASE_URL}/v1/reference-data/locations`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        keyword: query,
        subType: "CITY,AIRPORT",
        page: { limit: 5 }
      }
    }
  );

  const locations = response.data.data;

  if (!locations || locations.length === 0) {
    return null;
  }

  // Prefer airports over cities
  const airport =
    locations.find(l => l.subType === "AIRPORT") || locations[0];

  const resolved = {
    code: airport.iataCode,
    name: airport.name,
    type: airport.subType
  };

  locationCache[key] = resolved;
  return resolved;
}

module.exports = {
  resolveLocation
};
