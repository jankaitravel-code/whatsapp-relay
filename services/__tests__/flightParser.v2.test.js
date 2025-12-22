jest.mock("../locationService", () => ({
  resolveLocation: jest.fn(async (input) => {
    if (!input) return null;

    return {
      cityName: input,
      cityCode: input.slice(0, 3).toUpperCase()
    };
  })
}));

const { parseFlightQuery } = require("../flightParser");

describe("parseFlightQuery v2 — Round Trip Support", () => {

  /* ===============================
     V1 BASELINE (REGRESSION)
  =============================== */

  test("P1: one-way flight with outbound date", async () => {
    const result = await parseFlightQuery(
      "flight from delhi to london on 2025-12-10"
    );

    expect(result).toBeTruthy();
    expect(result.origin.cityName.toLowerCase()).toBe("delhi");
    expect(result.destination.cityName.toLowerCase()).toBe("london");
    expect(result.date).toBe("2025-12-10");
    expect(result.returnDate).toBeNull();
  });

  /* ===============================
     ROUND TRIP — VALID
  =============================== */

  test("P2: round trip with explicit returning keyword", async () => {
    const result = await parseFlightQuery(
      "flight from delhi to london on 2025-12-10 returning 2025-12-20"
    );

    expect(result).toBeTruthy();
    expect(result.date).toBe("2025-12-10");
    expect(result.returnDate).toBe("2025-12-20");
  });

  test("P2b: round trip with 'round trip' keyword", async () => {
    const result = await parseFlightQuery(
      "flight round trip delhi to london 2025-12-10 to 2025-12-20"
    );

    expect(result).toBeTruthy();
    expect(result.date).toBe("2025-12-10");
    expect(result.returnDate).toBe("2025-12-20");
  });

  /* ===============================
     ROUND TRIP — INVALID / IGNORED
  =============================== */

  test("P3: two dates without return marker → treated as one-way", async () => {
    const result = await parseFlightQuery(
      "flight delhi to london 2025-12-10 2025-12-20"
    );

    expect(result).toBeTruthy();
    expect(result.date).toBe("2025-12-10");
    expect(result.returnDate).toBeNull();
  });

  test("P4: return marker but only one date → incomplete", async () => {
    const result = await parseFlightQuery(
      "flight from delhi to london returning 2025-12-20"
    );

    expect(result).toBeNull();
  });

  test("P5: return date before outbound date → INVALID_RETURN_DATE", async () => {
    const result = await parseFlightQuery(
      "flight delhi to london 2025-12-20 returning 2025-12-10"
    );

    expect(result).toEqual({
      error: "INVALID_RETURN_DATE"
    });
  });

  test("P6: same-day return → INVALID_RETURN_DATE", async () => {
    const result = await parseFlightQuery(
      "flight delhi to london 2025-12-10 returning 2025-12-10"
    );

    expect(result).toEqual({
      error: "INVALID_RETURN_DATE"
    });
  });

  /* ===============================
     LOCATION & DATE ERRORS
  =============================== */

  test("P7: unknown origin city", async () => {
    const result = await parseFlightQuery(
      "flight from hdhghg to london on 2025-12-10"
    );

    expect(result).toEqual({
      error: "UNKNOWN_LOCATION"
    });
  });

  test("P8: invalid date format", async () => {
    const result = await parseFlightQuery(
      "flight from delhi to london on 10-12-2025"
    );

    expect(result).toBeNull();
  });

  test("P9: return keyword without return date", async () => {
    const result = await parseFlightQuery(
      "flight delhi to london on 2025-12-10 return"
    );

    expect(result).toBeNull();
  });

  /* ===============================
     SAFETY GUARANTEES
  =============================== */

  test("P10: parser does not fabricate return date", async () => {
    const result = await parseFlightQuery(
      "flight from delhi to london on 2025-12-10"
    );

    expect(result.returnDate).toBeNull();
  });
});
