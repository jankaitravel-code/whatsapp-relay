/**
 * Flight Search Service
 * Calls Amadeus Flight Offers API
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

async function searchFlights(input) {
  const {
    originLocationCode,
    destinationLocationCode,
    date,
    adults
  } = input;

  const passengerCount =
  Number.isInteger(adults) && adults > 0 ? adults : 1;

  console.log("🛫 Amadeus flight search params:", {
    originLocationCode,
    destinationLocationCode,
    departureDate: date,
    adults: passengerCount
  });

  const token = await getAccessToken();

  const response = await axios.get(
    `${AMADEUS_BASE_URL}/v2/shopping/flight-offers`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        originLocationCode,
        destinationLocationCode,
        departureDate: date,
        adults: passengerCount,
        max: 5
      }
    }
  );

  return {
    flights: response.data.data || [],
    carriers: response.data.dictionaries?.carriers || {}
  };
}

module.exports = {
  searchFlights
};
