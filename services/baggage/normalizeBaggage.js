/**
 * Normalize baggage information from an Amadeus flight offer
 *
 * Rules:
 * - Pure function
 * - No mutation
 * - No throws
 * - Returns null if baggage info unavailable
 */

function normalizeBaggage(flightOffer) {
  if (!flightOffer || !Array.isArray(flightOffer.travelerPricings)) {
    return null;
  }

  let cabinKg = Infinity;
  let checkinKg = Infinity;
  let checkinPieces = Infinity;

  flightOffer.travelerPricings.forEach(tp => {
    if (!Array.isArray(tp.fareDetailsBySegment)) return;

    tp.fareDetailsBySegment.forEach(seg => {
      const checked = seg.includedCheckedBags;
      const cabin = seg.includedCabinBags;

      // Checked baggage
      if (checked) {
        if (Number.isFinite(checked.weight)) {
          checkinKg = Math.min(checkinKg, checked.weight);
        }
        if (Number.isFinite(checked.quantity)) {
          checkinPieces = Math.min(checkinPieces, checked.quantity);
        }
      }

      // Cabin baggage (rare but exists)
      if (cabin && Number.isFinite(cabin.weight)) {
        cabinKg = Math.min(cabinKg, cabin.weight);
      }
    });
  });

  const hasCabin = cabinKg !== Infinity;
  const hasCheckinKg = checkinKg !== Infinity;
  const hasCheckinPieces = checkinPieces !== Infinity;

  if (!hasCabin && !hasCheckinKg && !hasCheckinPieces) {
    return null;
  }

  return {
    cabin: hasCabin ? `${cabinKg}kg` : null,
    checkin: hasCheckinKg
      ? `${checkinKg}kg`
      : hasCheckinPieces
      ? `${checkinPieces} pc`
      : null,
    note: "per passenger"
  };
}

module.exports = {
  normalizeBaggage
};
