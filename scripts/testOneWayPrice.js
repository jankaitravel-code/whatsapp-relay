const { computeOneWayFinalPrice } = require(
  "../services/price/computeOneWayFinalPrice"
);

const price = computeOneWayFinalPrice({
  flight: {
    price: {
      base: 4200,
      taxes: 800
    }
  },

  passengers: [
    {
      ageCategory: "ADULT",
      specialFare: "NONE",
      baggageKg: 5,
      seat: "FREE_AUTO",
      meal: "VEG"
    },
    {
      ageCategory: "SENIOR",
      specialFare: "SENIOR",
      baggageKg: 10,
      seat: "PAID_MANUAL",
      meal: "NON_VEG"
    }
  ],

  ancillaries: {
    baggage: {
      perKgPrice: 500
    },
    seats: {
      FREE_AUTO: 0,
      PAID_MANUAL: 600
    },
    meals: {
      NO_MEAL: 0,
      VEG: 250,
      NON_VEG: 300
    }
  },

  specialFareDiscounts: {
    SENIOR: 0.1, // 10%
    STUDENT: 0.05
  },

  discountCode: {
    type: "FLAT",
    amount: 500
  }
});

console.log(JSON.stringify(price, null, 2));
