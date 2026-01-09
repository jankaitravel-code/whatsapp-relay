const { buildFlexibilityOptions } = require("../../services/flexibility/buildFlexibilityOptions");

describe("buildFlexibilityOptions", () => {

  const baseFareRules = {
    refundability: { status: "REFUNDABLE" },
    change: { allowed: "YES" },
    cancellation: { allowed: "YES" }
  };

  test("returns multiple options for HIGH flexibility risk", () => {
    const result = buildFlexibilityOptions({
      fareRules: baseFareRules,
      flexibilityRisk: {
        level: "HIGH",
        confidence: "HIGH"
      }
    });

    expect(Array.isArray(result.options)).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.currency).toBeDefined();
  });

  test("returns limited options for MEDIUM flexibility risk", () => {
    const result = buildFlexibilityOptions({
      fareRules: baseFareRules,
      flexibilityRisk: {
        level: "MEDIUM",
        confidence: "HIGH"
      }
    });

    expect(Array.isArray(result.options)).toBe(true);
    expect(result.options.length).toBeGreaterThanOrEqual(0);
  });

  test("returns no options for LOW flexibility risk", () => {
    const result = buildFlexibilityOptions({
      fareRules: baseFareRules,
      flexibilityRisk: {
        level: "LOW",
        confidence: "HIGH"
      }
    });

    expect(result.options.length).toBe(0);
  });

  test("returns safe empty options when fare rules are missing", () => {
    const result = buildFlexibilityOptions({
      fareRules: null,
      flexibilityRisk: {
        level: "HIGH",
        confidence: "HIGH"
      }
    });

    expect(result.options).toEqual([]);
  });

  test("returns safe empty options when flexibility risk is missing", () => {
    const result = buildFlexibilityOptions({
      fareRules: baseFareRules,
      flexibilityRisk: null
    });

    expect(result.options).toEqual([]);
  });

});
