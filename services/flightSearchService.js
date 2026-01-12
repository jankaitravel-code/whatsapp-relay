/**
 * Flight Search Service
 * Calls Amadeus Flight Offers API
 */

const axios = require("axios");
const { getAccessToken } = require("./amadeusClient");
const AMADEUS_BASE_URL = "https://test.api.amadeus.com";
const { normalizeBaggage } = require("./baggage/normalizeBaggage");
const { log } = require("../utils/logger");
const { normalizeFareRules } = require("./flexibility/fareRules/normalizeFareRules");


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
    adults,
    travelClass
  } = input;

  const passengerCount =
  Number.isInteger(adults) && adults > 0 ? adults : 1;

  log("FLIGHT_SEARCH_REQUEST", {
    originLocationCode,
    destinationLocationCode,
    departureDate: date,
    adults: passengerCount,
    travelClass: travelClass || "ECONOMY"
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
        ...(travelClass ? { travelClass } : {}),
        max: 5
      }
    }
  );

  const flights = (response.data.data || []).map(f => {
    const fareRules = normalizeFareRules(f);
  
    return {
      ...f,
      _normalizedBaggage: normalizeBaggage(f),
  
      // 🔒 Defensive shape guarantee (NO logic change)
      _fareRules: fareRules || {
        refundability: { status: "UNKNOWN", confidence: "LOW" },
        change: { allowed: "UNKNOWN", confidence: "LOW", source: "MISSING" },
        cancellation: { allowed: "UNKNOWN", confidence: "LOW", source: "MISSING" }
      }
    };
  });

  log("FLIGHT_FARE_RULES_NORMALIZED", {
    count: flights.length,
    sample: flights.slice(0, 1).map(f => ({
      flightId: f.id,
      refundability: f._fareRules?.refundability?.status ?? "MISSING",
      changeAllowed: f._fareRules?.change?.allowed ?? "MISSING",
      cancelAllowed: f._fareRules?.cancellation?.allowed ?? "MISSING",
      changeSource: f._fareRules?.change?.source ?? "UNKNOWN",
      cancelSource: f._fareRules?.cancellation?.source ?? "UNKNOWN"
    }))
  });
  
  return {
    flights,
    carriers: response.data.dictionaries?.carriers || {}
  };
}

module.exports = {
  searchFlights,
  findCheapestAndFastest
};
