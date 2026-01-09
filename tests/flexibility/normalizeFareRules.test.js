const { normalizeFareRules } = require("../../services/fareRules/normalizeFareRules");

describe("normalizeFareRules", () => {

  test("normalizes complete and valid fare rules", () => {
    const flightOffer = {
      fareRules: {
        refundability: { status: "REFUNDABLE" },
        change: { allowed: "YES" },
        cancellation: { allowed: "YES" }
      }
    };

    const result = normalizeFareRules(flightOffer);

    expect(result).toEqual({
      refundability: { status: "REFUNDABLE" },
      change: { allowed: "YES" },
      cancellation: { allowed: "YES" }
    });
  });

  test("handles partial rules safely", () => {
    const flightOffer = {
      fareRules: {
        refundability: { status: "REFUNDABLE" }
        // change & cancellation missing
      }
    };

    const result = normalizeFareRules(flightOffer);

    expect(result.refundability.status).toBe("REFUNDABLE");
    expect(result.change).toBeDefined();
    expect(result.cancellation).toBeDefined();
  });

  test("returns null when fare rules are missing", () => {
    const flightOffer = {};

    const result = normalizeFareRules(flightOffer);

    expect(result).toBeNull();
  });

  test("returns null for invalid input", () => {
    const result = normalizeFareRules(null);

    expect(result).toBeNull();
  });

  test("does not mutate the input object", () => {
    const flightOffer = {
      fareRules: {
        refundability: { status: "REFUNDABLE" }
      }
    };

    const original = JSON.parse(JSON.stringify(flightOffer));

    normalizeFareRules(flightOffer);

    expect(flightOffer).toEqual(original);
  });

});
