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
        page: { limit: 10 }
      }
    }
  );

  const locations = response.data.data;

  if (!locations || locations.length === 0) {
    return null;
  }

  // Only keep locations that actually have an IATA code
  const withIata = locations.filter(l => l.iataCode);

  if (!withIata.length) {
    return null;
  }

  // Determine city code (used for flight search)
  const city =
    withIata.find(l => l.subType === "CITY") ||
    withIata[0];

  // Determine airport code (used for booking / display)
  const airport =
    withIata.find(l => l.subType === "AIRPORT") ||
    city;

  const resolved = {
    cityCode: city.iataCode,
    airportCode: airport.iataCode,
    cityName: city.name,
    airportName: airport.name,
    type: airport.subType
  };

  locationCache[key] = resolved;
  return resolved;
}

module.exports = {
  resolveLocation
};
