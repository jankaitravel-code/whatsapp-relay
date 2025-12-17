async function searchFlights(input) {
  const { originLocationCode, destinationLocationCode, date } = input;

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
        max: 3
      }
    }
  );

  return response.data.data;
}

module.exports = {
  searchFlights
};
