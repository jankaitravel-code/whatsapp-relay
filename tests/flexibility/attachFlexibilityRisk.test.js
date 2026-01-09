const { attachFlexibilityRisk } = require("../../services/flexibility/attachFlexibilityRisk");

describe("attachFlexibilityRisk", () => {

  test("attaches fare rules and flexibility risk when rules are present", () => {
    const flightOffer = {
      id: "FL123",
      airlineCode: "AI",
      fareFamily: "ECONOMY",
      fareRules: {
        refundability: { status: "REFUNDABLE" },
        change: { allowed: "YES" },
        cancellation: { allowed: "YES" }
      }
    };

    const result = attachFlexibilityRisk(flightOffer);

    expect(result._fareRules).toBeDefined();
    expect(result._flexibilityRisk).toBeDefined();
    expect(result._flexibilityRisk.level).toBe("HIGH");
  });

  test("returns original flight when fare rules cannot be normalized", () => {
    const flightOffer = {
      id: "FL456",
      airlineCode: "AI",
      fareFamily: "ECONOMY"
      // no fareRules
    };

    const result = attachFlexibilityRisk(flightOffer);

    expect(result._fareRules).toBeUndefined();
    expect(result._flexibilityRisk).toBeUndefined();
  });

  test("returns input as-is when flightOffer is null", () => {
    const result = attachFlexibilityRisk(null);

    expect(result).toBeNull();
  });

  test("does not mutate the original flight object", () => {
    const flightOffer = {
      id: "FL789",
      airlineCode: "AI",
      fareFamily: "ECONOMY",
      fareRules: {
        refundability: { status: "REFUNDABLE" }
      }
    };

    const original = JSON.parse(JSON.stringify(flightOffer));

    attachFlexibilityRisk(flightOffer);

    expect(flightOffer).toEqual(original);
  });

});
