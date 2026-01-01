/**
 * One-Way Booking Flow
 * Scope: Booking only
 * Entry: via conversation handoff from oneWayFlow.js
 */

const { log } = require("../../utils/logger");
const { recordSignal } = require("../../utils/abuseSignals");
const { computeOneWayFinalPrice } = require("../../services/price/computeOneWayFinalPrice");


function getEmptyPreferences() {
  return {
    baggageKg: 0,
    Meas: null,
    seats: null,
    insurance: false,
    flexibility: null
  };
}

function getIncludedBaggage(selectedFlight) {
  // 🔒 Stub for now — replace with real Amadeus parsing later
  return {
    cabinKg: 5,
    checkinKg: 15
  };
}

function getFlexibilityOptions(selectedFlight) {
  // 🔒 Stub pricing — replace with fare rules later
  return [
    {
      code: "NONE",
      label: "No flexibility",
      price: 0
    },
    {
      code: "DATE_CHANGE",
      label: "Free date change (no change fee)",
      price: 899
    },
    {
      code: "FULL_FLEX",
      label: "Free date change + cancellation",
      price: 1499
    }
  ];
}

function getEligibleSpecialFares(age) {
  const fares = [];

  if (age >= 60) fares.push("SENIOR");
  if (age >= 12 && age <= 25) fares.push("STUDENT");

  return fares;
}

async function handle(context) {
  const {
    from,
    text,
    rawText,
    conversation,
    sendWhatsAppMessage,
    setConversation,
    clearConversation
  } = context;

  /* ===============================
     BOOKING_PREFERENCES_INIT
  =============================== */
  
  if (conversation.state === "BOOKING_PREFERENCES_INIT") {
    setConversation(from, {
      ...conversation,
      state: "BOOKING_PREFERENCES"
    });
  
    // 🔁 Re-enter booking flow immediately (no user input)
    return handle({
      ...context,
      conversation: {
        ...conversation,
        state: "BOOKING_PREFERENCES"
      }
    });
  }

  // Guard: booking only
  if (!conversation || conversation.intent !== "FLIGHT_BOOKING") {
    return false;
  }

  const lower = (rawText || text || "").toLowerCase();
  const travellers = conversation.booking?.travellers
    ? [...conversation.booking.travellers]
    : [];

  if (conversation.state === "BOOKING_PREFERENCES") {
    const included = getIncludedBaggage(
      conversation.booking.selectedFlight
    );
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_BAGGAGE",
      booking: {
        ...conversation.booking,
        includedBaggage: included,
        preferences: getEmptyPreferences()
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "🧳 Let’s customise your booking\n\n" +
      `Your flight includes:\n` +
      `• Cabin baggage: ${included.cabinKg} kg\n` +
      `• Check-in baggage: ${included.checkinKg} kg\n\n` +
      "If you need extra baggage allawance, reply with the total additional weight.\n" +
      "Reply 0 if you don’t need extra baggage.\n\n" +
      "Example: 0, 5, 10 or 15"
    );
  
    return true;
  }

  
  if (conversation.state === "BOOKING_BAGGAGE") {
    const kg = Number(rawText);
  
    if (Number.isNaN(kg) || kg < 0 || kg > 50) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid number.\n" +
        "Example: 0, 5, 10 or 15"
      );
      return true;
    }

    setConversation(from, {
      ...conversation,
      state: "BOOKING_INSURANCE",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          baggageKg: kg
        }
      }
    });
    
    await sendWhatsAppMessage(
      from,
      `✅ Extra baggage set to ${kg} kg.\n\n` +
      "🛡️ Would you like to add travel insurance?\n\n" +
      "1️⃣ Yes, add insurance\n" +
      "2️⃣ No, continue without insurance"
      );
      return true;
    }
    
  if (conversation.state === "BOOKING_INSURANCE") {
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose a valid option:\n\n" +
        "1️⃣ Yes, add insurance\n" +
        "2️⃣ No, continue without insurance"
      );
      return true;
    }
  
    const insuranceSelected = lower === "1";
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_FLEXIBILITY",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          insurance: insuranceSelected
        }
      }
    });
  
    await sendWhatsAppMessage(
      from,
      (insuranceSelected
        ? "🛡️ Travel insurance added.\n\n"
        : "⏭️ Skipping travel insurance.\n\n") +
      "Now choose your flexibility option:\n\n" +
      "1️⃣ No flexibility (lowest price)\n" +
      "2️⃣ Free date change (₹X)\n" +
      "3️⃣ Free date + flight change (₹Y)\n\n" +
      "Reply with 1, 2 or 3"
    );
  
    return true;
  }

  if (conversation.state === "BOOKING_FLEXIBILITY") {
    const flexibilityMap = {
      "1": { type: "NONE", label: "No flexibility" },
      "2": { type: "DATE_CHANGE", label: "Free date change" },
      "3": { type: "DATE_FLIGHT_CHANGE", label: "Free date & flight change" }
    };
  
    const selectedFlex = flexibilityMap[lower];
  
    if (!selectedFlex) {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose a valid flexibility option:\n\n" +
        "1️⃣ No flexibility (lowest price)\n" +
        "2️⃣ Free date change\n" +
        "3️⃣ Free date + flight change\n\n" +
        "Reply with 1, 2 or 3"
      );
      return true;
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_DISCOUNT",
      booking: {
        ...conversation.booking,
        preferences: {
          ...conversation.booking.preferences,
          flexibility: selectedFlex
        }
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `🔁 Flexibility selected: ${selectedFlex.label}.\n\n` +
      "If you have a discount or coupon code, please enter it now.\n" +
      "Reply **NONE** if you don’t have one."
    );
  
    return true;
  }

  /* ===============================
     BOOKING_DISCOUNT
  =============================== */

  if (conversation.state === "BOOKING_DISCOUNT") {
    const input = rawText.trim();
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLERS_INIT",
      booking: {
        ...conversation.booking,
        discountCode: input === "NONE" ? null : input
      }
    });
  
    await sendWhatsAppMessage(
      from,
      input === "NONE"
        ? "🏷️ No discount code applied.\n\nReady to add traveller details?"
        : `🏷️ Discount code *${input}* noted.\n\nReady to add traveller details?`
    );
  
    return true;
  }

    /* ===============================
       TRAVELLER INFORMATION
    =============================== */


  if (conversation.state === "BOOKING_TRAVELLERS_INIT") {
    const total = conversation.booking.passengersCount;
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_NAME",
      booking: {
        ...conversation.booking,
        travellers: [],
        currentTravellerIndex: 0
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `🧑 Traveller details\n\n` +
      `Traveller 1 of ${total}\n` +
      `Please enter first name and last name.\n\n` +
      `Example: Rahul Sharma`
    );
  
    return true;
  }
  
  //NAME INPUT --> Age

  if (conversation.state === "BOOKING_TRAVELLER_NAME") {
    const parts = rawText.trim().split(" ");

    if (parts.length < 2) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter FULL name of the traveller as it appears on the identity proof.\nExample: Rahul Sharma"
      );
      return true;
    }
  
    const traveller = {
      index: conversation.booking.currentTravellerIndex + 1,
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
      ageCategory: "ADULT",
      specialFare: "NONE",
      seat: null,
      meal: null
    };

    setConversation(from, {
    ...conversation,
    state: "BOOKING_TRAVELLER_AGE",
    booking: {
      ...conversation.booking,
      travellers: [...conversation.booking.travellers, traveller],
      travellerLocked: false
    }
  });
  
    await sendWhatsAppMessage(
      from,
      "🎂 Please enter traveller's age."
    );
  
    return true;
  }

  //Traveller's age --> Special Fare

  if (conversation.state === "BOOKING_TRAVELLER_AGE") {
    const age = Number(rawText);
  
    if (Number.isNaN(age) || age <= 0 || age > 120) {
      await sendWhatsAppMessage(from, "❌ Please enter a valid age.");
      return true;
    }
  
    const t = travellers[travellers.length - 1];
  
    t.age = age;
  
    // ✅ Age category (do NOT mix with fare)
    if (age < 2) t.ageCategory = "INFANT";
    else if (age < 12) t.ageCategory = "CHILD";
    else t.ageCategory = "ADULT";
  
    // ✅ Compute eligible special fares ONCE
    t.eligibleSpecialFares = getEligibleSpecialFares(age);
  
    // 🔽 Build dynamic fare options
    let message =
      `🎫 Special fares for ${t.firstName} ${t.lastName}\n\n` +
      "1️⃣ None\n";
  
    const optionMap = { "1": "NONE" };
    let optionNumber = 2;
  
    if (t.eligibleSpecialFares.includes("SENIOR")) {
      message += `${optionNumber}️⃣ Senior Citizen\n`;
      optionMap[String(optionNumber)] = "SENIOR";
      optionNumber++;
    }
  
    if (t.eligibleSpecialFares.includes("STUDENT")) {
      message += `${optionNumber}️⃣ Student\n`;
      optionMap[String(optionNumber)] = "STUDENT";
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_SPECIAL_FARE",
      booking: {
        ...conversation.booking,
        travellers,
        _specialFareOptionMap: optionMap
      }
    });
  
    await sendWhatsAppMessage(from, message);
  
    return true;
  }

  //SPECIAL FARE --> Seat Selection

  if (conversation.state === "BOOKING_TRAVELLER_SPECIAL_FARE") {
    const optionMap = conversation.booking._specialFareOptionMap;
  
    const selectedFare = optionMap[lower];
  
    if (!selectedFare) {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose one of the listed options."
      );
      return true;
    }
  
    const travellers = [...conversation.booking.travellers];
    travellers[travellers.length - 1].specialFare = selectedFare;
  
    // 🔥 Clean up temporary map
    const { _specialFareOptionMap, ...bookingRest } = conversation.booking;
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_SEAT",
      booking: {
        ...bookingRest,
        travellers
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "💺 Seat selection\n\n" +
      "1️⃣ Any free seat\n" +
      "2️⃣ Choose a paid seat"
    );
  
    return true;
  }

  //SEAT SELECTION --> Meal selection

  if (conversation.state === "BOOKING_TRAVELLER_SEAT") {
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(
        from,
        "❌ Please choose:\n1 Any free seat\n2 Paid seat"
      );
      return true;
    }
  
    travellers[travellers.length - 1].seat =
      lower === "1" ? "FREE_AUTO" : "PAID_MANUAL";
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_MEAL",
      booking: {
        ...conversation.booking,
        travellers
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "🍽️ Meal preference\n\n" +
      "1️⃣ No meal\n" +
      "2️⃣ Vegetarian\n" +
      "3️⃣ Non-Vegetarian\n" +
      "4️⃣ Vegan"
    );
  
    return true;
  }

  //MEAL SELECTION --> Traveller review

  if (conversation.state === "BOOKING_TRAVELLER_MEAL") {
    const map = {
      "1": "NO_MEAL",
      "2": "VEG",
      "3": "NON_VEG",
      "4": "VEGAN"
    };
  
    if (!map[lower]) {
      await sendWhatsAppMessage(
        from,
        "❌ Please select a valid meal option."
      );
      return true;
    }

    travellers[travellers.length - 1].meal = map[lower];

    const t = travellers[travellers.length - 1];
    
    setConversation(from, {
      ...conversation,
      state: "BOOKING_TRAVELLER_CONFIRM",
      booking: {
        ...conversation.booking,
        travellers
      }
    });
    
    await sendWhatsAppMessage(
      from,
      `👤 Traveller Review\n\n` +
      `Name: ${t.firstName} ${t.lastName}\n` +
      `Age: ${t.age} (${t.ageCategory})\n` +
      `Special Fare: ${t.specialFare}\n` +
      `Seat: ${t.seat}\n` +
      `Meal: ${t.meal}\n\n` +
      `Reply:\n1️⃣ Confirm\n2️⃣ Edit`
    );
    
    return true;
  }

  //Edit/Confirm --> next traveller loop

  if (conversation.state === "BOOKING_TRAVELLER_CONFIRM") {
       
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(from, "❌ Reply 1 to confirm or 2 to edit.");
      return true;
      }
    
    if (lower === "2") {
      const travellers = [...conversation.booking.travellers];
      travellers.pop(); // 🔥 remove current traveller safely
    
      setConversation(from, {
        ...conversation,
        state: "BOOKING_TRAVELLER_NAME",
        booking: {
          ...conversation.booking,
          travellers,
          travellerLocked: false
        }
      });
    
      await sendWhatsAppMessage(
        from,
        "✏️ Let’s edit traveller details.\nEnter first and last name."
      );
      return true;
    }
    
      const nextIndex = conversation.booking.currentTravellerIndex + 1;
      const total = conversation.booking.passengersCount;
    
      if (nextIndex >= total) {
        setConversation(from, {
          ...conversation,
          state: "BOOKING_FREQUENT_FLYER",
          booking: {
            ...conversation.booking,
            travellerLocked: true
          }
        });
    
        await sendWhatsAppMessage(
          from,
          "✅ Traveller details completed.\n\nPlease enter your frequent flyer number or type None to skip."
        );
        return true;
      }
    
      setConversation(from, {
        ...conversation,
        state: "BOOKING_TRAVELLER_NAME",
        booking: {
          ...conversation.booking,
          currentTravellerIndex: nextIndex,
          travellerLocked: false
        }
      });
    
      await sendWhatsAppMessage(
        from,
        `🧑 Traveller ${nextIndex + 1} of ${total}\n\nPlease enter first and last name.`
      );
    
      return true;
    }

  /* ===============================
     BOOKING_FREQUENT_FLYER
  =============================== */
  
  if (conversation.state === "BOOKING_FREQUENT_FLYER") {
    const profileFF = conversation.profile?.frequentFlyer;
  
    // Profile FF detected → confirmation step
    if (profileFF && !conversation.booking.frequentFlyer?.confirmed) {
      if (lower === "1") {
        setConversation(from, {
          ...conversation,
          state: "BOOKING_GST_DETAILS",
          booking: {
            ...conversation.booking,
            frequentFlyer: {
              ...profileFF,
              confirmed: true
            }
          }
        });
  
        await sendWhatsAppMessage(
          from,
          "✅ Frequent flyer number saved.\n\nNow let’s add GST details (optional)."
        );
        return true;
      }
  
      if (lower === "2") {
        await sendWhatsAppMessage(
          from,
          "✏️ Please enter your frequent flyer number."
        );
        return true;
      }
  
      if (lower === "3") {
        setConversation(from, {
          ...conversation,
          state: "BOOKING_GST_DETAILS"
        });
  
        await sendWhatsAppMessage(
          from,
          "⏭️ Skipped frequent flyer.\n\nNow let’s add GST details (optional)."
        );
        return true;
      }
  
      await sendWhatsAppMessage(
        from,
        "❌ Reply:\n1 Use\n2 Change\n3 Skip"
      );
      return true;
    }
  
    // Manual entry
    if (lower === "none") {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_GST_DETAILS"
      });
  
      await sendWhatsAppMessage(
        from,
        "⏭️ Skipped frequent flyer.\n\nNow let’s add GST details (optional)."
      );
      return true;
    }
  
    if (!rawText || rawText.length < 5) {
      await sendWhatsAppMessage(
        from,
        "❌ Please enter a valid frequent flyer number or reply NONE."
      );
      return true;
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_GST_DETAILS",
      booking: {
        ...conversation.booking,
        frequentFlyer: {
          airline: conversation.booking.selectedFlight.validatingAirlineCodes?.[0],
          number: rawText.trim(),
          confirmed: true
        }
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "✅ Frequent flyer number saved.\n\n Enter your GST number or type None if you dont have one."
    );
    return true;
  }

  /* ===============================
     BOOKING_GST_DETAILS
  =============================== */
  
  if (conversation.state === "BOOKING_GST_DETAILS") {
    if (lower === "none") {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_PRICE_COMPUTE"
      });
  
      await sendWhatsAppMessage(
        from,
        "⏭️ GST details skipped.\n\nCalculating final price… reply ok to see it."
      );
      return true;
    }
  
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  
    if (!gstRegex.test(rawText)) {
      await sendWhatsAppMessage(
        from,
        "❌ Invalid GST number.\nPlease re-enter or reply NONE to skip."
      );
      return true;
    }
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_PRICE_COMPUTE",
      booking: {
        ...conversation.booking,
        gst: {
          gstin: rawText.trim().toUpperCase()
        }
      }
    });
  
    await sendWhatsAppMessage(
      from,
      "✅ GST details saved.\n\nCalculating final price… reply ok to see it"
    );
    return true;
  }



  /* ===============================
   BOOKING_PRICE_COMPUTE
  =============================== */
  if (conversation.state === "BOOKING_PRICE_COMPUTE") {
    if (!conversation.booking?.travellers?.length) {
      await sendWhatsAppMessage(
        from,
        "⚠️ Traveller information missing. Please restart booking."
      );
      return true;
    }

    try {
      const passengers = conversation.booking.travellers.map(t => ({
        index: t.index,
        age: t.age,
        ageCategory: t.ageCategory,
        specialFare: t.specialFare || "NONE",
        seat: t.seat || "FREE_AUTO",
        meal: t.meal || "NO_MEAL"
      }));
  
      const discountCode =
        conversation.booking.discountCode &&
        conversation.booking.discountCode.toUpperCase() !== "NONE"
          ? conversation.booking.discountCode
          : null;
  
      log("PRICE_COMPUTE_INPUT", {
        selectedFlight: conversation.booking.selectedFlight.id,
        passengers,
        preferences: conversation.booking.preferences,
        discountCode
      });
  
      const price = computeOneWayFinalPrice({
        selectedFlight: conversation.booking.selectedFlight, // ✅ correct key
        travellers: passengers,                              // ✅ correct key
        preferences: conversation.booking.preferences || {},
        discountCode
      });
  
      log("FINAL_PRICE_COMPUTED", price);
  
      setConversation(from, {
        ...conversation,
        state: "BOOKING_PRICE_REVIEW",
        booking: {
          ...conversation.booking,
          priceSnapshot: price
        }
      });
  
      await sendWhatsAppMessage(
        from,
        `💰 Final Price\n\n` +
        `Base Fare: ${price.currency} ${price.base.total}\n` +
        `Extras: ${price.currency} ${price.totals.bookingAdjustments}\n` +
        `Discount: ${price.currency} ${price.bookingAdjustments.discount.delta}\n\n` +
        `*Total Payable: ${price.currency} ${price.totals.grandTotal}*\n\n` +
        `Reply 1️⃣ See alternative flights\n2️⃣ Continue to payment`
      );
  
      return true;
    } catch (err) {
      log("PRICE_COMPUTE_ERROR", { err: err.message });
  
      await sendWhatsAppMessage(
        from,
        "⚠️ Something went wrong while calculating the price. Please try again."
      );
      return true;
    }
  }

  /* ===============================
     BOOKING_PRICE_REVIEW
  =============================== */
  
  if (conversation.state === "BOOKING_PRICE_REVIEW") {
    const price = conversation.booking?.priceSnapshot;
  
    // 🔒 Safety guard
    if (!price) {
      await sendWhatsAppMessage(
        from,
        "⚠️ Price details missing. Please restart booking."
      );
      return true;
    }
  
    if (lower !== "1" && lower !== "2") {
      await sendWhatsAppMessage(
        from,
        "❌ Please reply with:\n" +
        "1️⃣ See alternative flights\n" +
        "2️⃣ Continue to payment"
      );
      return true;
    }

    if (lower === "1") {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_ALTERNATIVES_SNAPSHOT"
      });
      return true;
    }
    
    if (lower === "2") {
      setConversation(from, {
        ...conversation,
        state: "BOOKING_PAYMENT_INIT"
      });
    
      await sendWhatsAppMessage(
        from,
        "💳 Proceeding to payment…"
      );
      return true;
    }
  }

  /* ===============================
     BOOKING_ALTERNATIVES_SNAPSHOT
  ================================ */
  
  if (conversation.state === "BOOKING_ALTERNATIVES_SNAPSHOT") {
    const price = conversation.booking?.priceSnapshot;
    const selected = conversation.booking?.selectedFlight;
    const results = conversation.search?.results;
  
    if (!price || !selected || !Array.isArray(results)) {
      await sendWhatsAppMessage(
        from,
        "⚠️ Unable to show alternatives. Please restart booking."
      );
      return true;
    }
  
    const snapshot = buildAlternativesSnapshot({
      selectedFlight: selected,
      priceSnapshot: price,
      searchResults: results
    });
  
    log("ALTERNATIVES_SNAPSHOT_BUILT", snapshot);

    // First entry only → build & show snapshot
    if (!conversation.temp?.alternativesShown) {
      setConversation(from, {
        ...conversation,
        temp: {
          alternativesShown: true,
          cheapestFlight: snapshot.cheapestFlight,
          fastestFlight: snapshot.fastestFlight
        }
      });
    
      await sendWhatsAppMessage(from, snapshot.message);
      return true;
    }

    if (!["1", "2", "3", "4"].includes(lower)) {
      await sendWhatsAppMessage(
        from,
        "❌ Please reply with 1, 2, 3 or 4.\n\nType *cancel* to stop."
      );
      return true;
    }
  
    // 1️⃣ Keep selected flight
    if (lower === "1") {
      setConversation(from, {
        ...conversation,
        temp: null,
        state: "BOOKING_PAYMENT_INIT"
      });
  
      await sendWhatsAppMessage(from, "💳 Proceeding to payment…");
      return true;
    }
  
    // 2️⃣ or 3️⃣ Swap flight
    if (lower === "2" || lower === "3") {
      const newFlight =
        lower === "2"
          ? conversation.temp?.cheapestFlight
          : conversation.temp?.fastestFlight;
  
      if (!newFlight) {
        await sendWhatsAppMessage(
          from,
          "⚠️ This option is unavailable. Please choose another."
        );
        return true;
      }
  
      setConversation(from, {
        ...conversation,
        booking: {
          ...conversation.booking,
          selectedFlight: newFlight,
          priceSnapshot: null
        },
        temp: null,
        state: "BOOKING_PRICE_COMPUTE"
      });
  
      await sendWhatsAppMessage(
        from,
        "🔄 Updating flight and recalculating price…"
      );
      return true;
    }
  
    // 4️⃣ Change date
    if (lower === "4") {
      setConversation(from, {
        ...conversation,
        temp: null,
        state: "BOOKING_CHANGE_DATE"
      });
  
      await sendWhatsAppMessage(
        from,
        "📅 Please enter the new travel date (YYYY-MM-DD)."
      );
      return true;
    }
  }



    
  /* ===============================
     GLOBAL CANCEL
  =============================== */
  if (lower === "cancel") {
    recordSignal("booking_cancelled", { user: from });
    clearConversation(from);
    await sendWhatsAppMessage(from, "❌ Booking cancelled.");
    return true;
  }
  
  /* ===============================
     FALLBACK
  =============================== */
  await sendWhatsAppMessage(
    from,
    "Please reply *cancel* to stop booking."
  );
  return true;
}

module.exports = {
  handle
};

function buildAlternativesSnapshot({ selectedFlight, priceSnapshot, searchResults }) {
  const sameDay = searchResults.filter(f =>
    f.departureDate === selectedFlight.departureDate &&
    f.id !== selectedFlight.id
  );

  const cheapest = [...sameDay].sort((a, b) => a.totalPrice - b.totalPrice)[0];
  const fastest = [...sameDay].sort((a, b) => a.totalDuration - b.totalDuration)[0];

  const currency = priceSnapshot.currency;
  const selectedTotal = priceSnapshot.totals.grandTotal;

  let message =
    `✈️ Flight alternatives\n` +
    `(Same travellers, seats, meals & add-ons)\n\n` +

    `────────────────────\n` +
    `1️⃣ Selected flight\n` +
    `💰 ${currency} ${selectedTotal}\n` +
    `🕛 ${selectedFlight.departureDate} · ${selectedFlight.departureTime}\n\n`;

  if (cheapest) {
    message +=
      `────────────────────\n` +
      `2️⃣ Cheapest option\n` +
      `💸 Save ${currency} ${selectedTotal - cheapest.totalPrice}\n` +
      `🕟 ${cheapest.departureDate} · ${cheapest.departureTime}\n\n`;
  }

  if (fastest) {
    message +=
      `────────────────────\n` +
      `3️⃣ Fastest option\n` +
      `⏱️ Save ${formatDuration(selectedFlight.totalDuration - fastest.totalDuration)}\n` +
      `💸 +${currency} ${fastest.totalPrice - selectedTotal}\n\n`;
  }

  message +=
    `────────────────────\n` +
    `4️⃣ Change travel date\n\n` +
    `Reply 1–4 or type *cancel*`;

  return {
    message,
    cheapestFlight: cheapest || null,
    fastestFlight: fastest || null
  };
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

