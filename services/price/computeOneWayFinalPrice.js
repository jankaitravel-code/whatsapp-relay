/**
 * Final Price Computation Engine
 * --------------------------------
 * - No side effects
 * - Deterministic
 * - Safe to unit-test
 * - Uses current booking preferences only
 */

function getSpecialFareDelta(type) {
  switch (type) {
    case "SENIOR":
      return -1200;
    case "STUDENT":
      return -800;
    default:
      return 0;
  }
}

function getSeatPrice(seatType) {
  return seatType === "PAID_MANUAL" ? 800 : 0;
}

function getMealPrice(meal) {
  const map = {
    NO_MEAL: 0,
    VEG: 350,
    NON_VEG: 450,
    VEGAN: 400
  };
  return map[meal] ?? 0;
}

function getDiscountDelta(code) {
  if (!code) return 0;

  const map = {
    NY2025: -1000,
    WELCOME500: -500
  };

  return map[code] ?? 0;
}

/**
 * MAIN EXPORT
 */
function computeOneWayFinalPrice({
  selectedFlight,
  travellers = [],
  preferences = {},
  discountCode = null
}) {
  if (!selectedFlight || !Array.isArray(travellers)) {
    throw new Error("Invalid input to computeOneWayFinalPrice()");
  }

  const currency = selectedFlight.price.currency || "INR";
  const basePerTraveller = Number(selectedFlight.price.total);
  const travellerCount = travellers.length;

  /* ------------------------------
     BASE PRICE
  ------------------------------ */
  const baseTotal = basePerTraveller * travellerCount;

  /* ------------------------------
     TRAVELLER-LEVEL ADJUSTMENTS
  ------------------------------ */
  const travellerAdjustments = travellers.map(t => {
    const specialFareDelta = getSpecialFareDelta(t.specialFare);
    const seatPrice = getSeatPrice(t.seat);
    const mealPrice = getMealPrice(t.meal);

    const totalDelta =
      specialFareDelta + seatPrice + mealPrice;

    return {
      travellerIndex: t.index,
      specialFare: {
        type: t.specialFare,
        delta: specialFareDelta
      },
      seat: {
        type: t.seat,
        price: seatPrice
      },
      meal: {
        type: t.meal,
        price: mealPrice
      },
      totalDelta
    };
  });

  const travellerDeltaTotal =
    travellerAdjustments.reduce((sum, t) => sum + t.totalDelta, 0);

  /* ------------------------------
     BOOKING-LEVEL ADJUSTMENTS
  ------------------------------ */
  const baggagePrice = preferences?.baggageCost ?? 0;
  const insurancePrice = preferences?.insurance?.price ?? 0;
  const flexibilityPrice = preferences?.flexibility?.price ?? 0;
  const discountDelta = getDiscountDelta(discountCode);

  const bookingAdjustmentTotal =
    baggagePrice +
    insurancePrice +
    flexibilityPrice +
    discountDelta;

  /* ------------------------------
     GRAND TOTAL
  ------------------------------ */
  const grandTotal =
    baseTotal +
    travellerDeltaTotal +
    bookingAdjustmentTotal;

  /* ------------------------------
     PRICE SNAPSHOT (IMMUTABLE)
  ------------------------------ */
  return {
    currency,

    base: {
      perTraveller: basePerTraveller,
      travellers: travellerCount,
      total: baseTotal
    },

    travellerAdjustments,

    bookingAdjustments: {
      baggage: {
        extraKg: preferences?.baggageKg ?? 0,
        price: baggagePrice
      },
      insurance: {
        selected: preferences?.insurance?.selected ?? false,
        price: insurancePrice
      },
      flexibility: {
        type: preferences?.flexibility?.type ?? "NONE",
        price: flexibilityPrice
      },
      discount: {
        code: discountCode ?? null,
        delta: discountDelta
      }
    },
    totals: {
      travellerAdjustments: travellerDeltaTotal,
      bookingAdjustments: bookingAdjustmentTotal,
      grandTotal
    }
  };
}

module.exports = {
  computeOneWayFinalPrice
};
