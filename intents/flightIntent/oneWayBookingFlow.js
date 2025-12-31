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
        ? "🏷️ No discount code applied.\n\nReady add traveller details?"
        : `🏷️ Discount code *${input}* noted.\n\nReady add traveller details?`
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
          state: "BOOKING_PRICE_COMPUTE",
          booking: {
            ...conversation.booking,
            travellerLocked: true
          }
        });
    
        await sendWhatsAppMessage(
          from,
          "✅ Traveller details completed.\n\nCalculating final price…"
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
     Booking_price_computation
    =============================== */

  if (conversation.state === "BOOKING_PRICE_COMPUTE") {
    const price = computeOneWayFinalPrice({
      flight: conversation.booking.selectedFlight,
      passengers: conversation.booking.travellers,
      preferences: conversation.booking.preferences,
      discountCode: conversation.booking.discountCode
    });
    
    log("FINAL_PRICE_COMPUTED", price);
  
    setConversation(from, {
      ...conversation,
      state: "BOOKING_PRICE_REVIEW", // 👈 next logical step
      booking: {
        ...conversation.booking,
        priceSnapshot: price
      }
    });
  
    await sendWhatsAppMessage(
      from,
      `💰 Final Price\n\n` +
      `Base Fare: ₹${price.baseFare}\n` +
      `Extras: ₹${price.extrasTotal}\n` +
      `Discount: -₹${price.discount}\n` +
      `Taxes: ₹${price.taxes}\n\n` +
      `*Total Payable: ₹${price.grandTotal}*\n\n` +
      `Reply 1️⃣ to continue to payment\n2️⃣ to cancel`
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
