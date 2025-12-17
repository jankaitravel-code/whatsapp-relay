/**
 * Flight Search Service
 * Responsible for searching flights using Amadeus
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

/**
 * Search one-way flights
 */
async function searchFlights({ originLocationCode, destinationLocationCode, date }) {
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
        max: 3
      }
    }
  );

  return response.data.data;
}

module.exports = {
  searchFlights
};
