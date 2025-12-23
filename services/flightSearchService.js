/**
 * Flight Search Service
 * Calls Amadeus Flight Offers API
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

async function searchFlights(input) {
  const { originLocationCode, destinationLocationCode, date } = input;

  if (params.returnDate) {
    throw new Error("RETURN_DATE_NOT_SUPPORTED");
  }

  console.log("🛫 Amadeus flight search params:", {
    originLocationCode,
    destinationLocationCode,
    departureDate: date
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
        adults: 1,
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
