/**
 * Normalize baggage information from an Amadeus flight offer
 *
 * Rules:
 * - Pure function
 * - No mutation
 * - No inference
 * - Deterministic output
 * - Always returns a string for UX
 */

function normalizeBaggage(flightOffer) {
  const pricing = flightOffer?.travelerPricings?.[0];
  const segments = pricing?.fareDetailsBySegment;

  let cabin = "Not specified";
  let checkin = "Not specified";

  if (Array.isArray(segments)) {
    for (const seg of segments) {
      const cabinBag = seg?.includedCabinBags;
      const checkedBag = seg?.includedCheckedBags;

      // Cabin baggage
      if (cabinBag) {
        if (Number.isInteger(cabinBag.quantity)) {
          cabin =
            cabinBag.quantity === 0
              ? "Not included"
              : `${cabinBag.quantity} bag`;
        } else if (
          Number.isFinite(cabinBag.weight) &&
          cabinBag.weightUnit
        ) {
          cabin = `${cabinBag.weight} ${cabinBag.weightUnit}`;
        }
      }

      // Check-in baggage
      if (checkedBag) {
        if (Number.isInteger(checkedBag.quantity)) {
          checkin =
            checkedBag.quantity === 0
              ? "Not included"
              : `${checkedBag.quantity} bag`;
        } else if (
          Number.isFinite(checkedBag.weight) &&
          checkedBag.weightUnit
        ) {
          checkin = `${checkedBag.weight} ${checkedBag.weightUnit}`;
        }
      }

      // First definitive info wins
      if (cabin !== "Not specified" || checkin !== "Not specified") {
        break;
      }
    }
  }

  return `Baggage: Cabin ${cabin} | Check-in ${checkin}`;
}

module.exports = {
  normalizeBaggage
};
