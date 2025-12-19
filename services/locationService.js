/**
 * Location Service
 * Resolves user input to both CITY and AIRPORT IATA codes (OTA-grade)
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

// Simple in-memory cache (safe for now)
const locationCache = {};

async function resolveLocation(query) {
  const key = query.trim().toLowerCase();

  if (locationCache[key]) {
    return locationCache[key];
  }

  const token = await getAccessToken();

  async function fetchLocations(subType) {
    const res = await axios.get(
      `${AMADEUS_BASE_URL}/v1/reference-data/locations`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          keyword: query,
          subType,
          page: { limit: 10 }
        }
      }
    );
    return res.data?.data || [];
  }

  // 1️⃣ Try CITY first (most stable for human input)
  let locations = await fetchLocations("CITY");

  // 2️⃣ Fallback to AIRPORT if needed
  if (!locations.length) {
    locations = await fetchLocations("AIRPORT");
  }

  if (!locations.length) {
    return null;
  }

  const withIata = locations.filter(l => l.iataCode);
  if (!withIata.length) {
    return null;
  }

  const chosen = withIata[0];

  const resolved = {
    cityCode: chosen.iataCode,
    airportCode: chosen.iataCode,
    cityName: chosen.name,
    airportName: chosen.name,
    type: chosen.subType
  };

  locationCache[key] = resolved;
  return resolved;
}

module.exports = {
  resolveLocation
};
