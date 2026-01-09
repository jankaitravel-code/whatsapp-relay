const { scoreFareFlexibility } = require("../../services/flexibility/scoreFareFlexibility");

describe("scoreFareFlexibility", () => {

  test("HIGH flexibility when all rules are favorable and known", () => {
    const fareRules = {
      refundability: { status: "REFUNDABLE" },
      change: { allowed: "YES" },
      cancellation: { allowed: "YES" }
    };

    const result = scoreFareFlexibility({ fareRules });

    expect(result.score).toBe(100);
    expect(result.level).toBe("HIGH");
    expect(result.confidence).toBe("HIGH");
  });

  test("MEDIUM confidence when exactly one rule is UNKNOWN", () => {
    const fareRules = {
      refundability: { status: "UNKNOWN" },
      change: { allowed: "YES" },
      cancellation: { allowed: "YES" }
    };

    const result = scoreFareFlexibility({ fareRules });

    expect(result.confidence).toBe("MEDIUM");
    expect(result.level).toBe("HIGH"); // score still high enough
  });

  test("LOW confidence when multiple rules are UNKNOWN", () => {
    const fareRules = {
      refundability: { status: "UNKNOWN" },
      change: { allowed: "UNKNOWN" },
      cancellation: { allowed: "YES" }
    };

    const result = scoreFareFlexibility({ fareRules });

    expect(result.confidence).toBe("LOW");
  });

  test("LOW flexibility but HIGH confidence when rules are bad but known", () => {
    const fareRules = {
      refundability: { status: "NON_REFUNDABLE" },
      change: { allowed: "NO" },
      cancellation: { allowed: "NO" }
    };

    const result = scoreFareFlexibility({ fareRules });

    expect(result.level).toBe("LOW");
    expect(result.confidence).toBe("HIGH"); // critical distinction
  });

  test("Safe LOW result when fareRules is missing", () => {
    const result = scoreFareFlexibility({ fareRules: null });

    expect(result.level).toBe("LOW");
    expect(result.confidence).toBe("LOW");
    expect(result.score).toBe(0);
  });

});
