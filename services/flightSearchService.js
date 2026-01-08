/**
 * Flight Search Service
 * Calls Amadeus Flight Offers API
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

function durationToMinutes(isoDuration) {
  if (!isoDuration) return Infinity;

  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return Infinity;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);

  return hours * 60 + minutes;
}

function findCheapestAndFastest(flights) {
  let cheapestIndex = -1;
  let fastestIndex = -1;

  let lowestPrice = Infinity;
  let shortestDuration = Infinity;

  flights.forEach((f, i) => {
    const price = Number(f.price?.total);
    const duration = durationToMinutes(f.itineraries?.[0]?.duration);

    if (!isNaN(price) && price < lowestPrice) {
      lowestPrice = price;
      cheapestIndex = i;
    }

    if (duration < shortestDuration) {
      shortestDuration = duration;
      fastestIndex = i;
    }
  });

  return { cheapestIndex, fastestIndex };
}

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
  searchFlights,
  findCheapestAndFastest
};
