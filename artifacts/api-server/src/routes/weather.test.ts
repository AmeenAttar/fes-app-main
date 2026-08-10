import { describe, expect, it } from "vitest";

import {
  buildResponse,
  lookupCondition,
  round,
  weekdayShortFromIsoDate,
} from "./weather";

/**
 * The weather widget is the most visible thing on the home screen, and every
 * field in it is defaulted. That is the right call — a missing humidity should
 * not blank the whole card — but it means a change in Open-Meteo's payload
 * shows up as a confident display of zeroes rather than an error. These tests
 * pin which defaults apply where.
 */

describe("round", () => {
  it("rounds normally", () => {
    expect(round(71.4)).toBe(71);
    expect(round(71.5)).toBe(72);
    expect(round(-3.2)).toBe(-3);
  });

  // Every numeric field in the response runs through this, so its handling of
  // absent values is what decides whether the card shows 0 or breaks.
  it("falls back for anything that is not a finite number", () => {
    expect(round(undefined)).toBe(0);
    expect(round(NaN)).toBe(0);
    expect(round(Infinity)).toBe(0);
    expect(round(undefined, 42)).toBe(42);
  });
});

describe("lookupCondition", () => {
  it("maps known WMO codes", () => {
    expect(lookupCondition(0, true).condition).toBe("Clear");
    expect(lookupCondition(0, true).iconName).not.toBe("cloud");
  });

  // Clear and mainly-clear are the only codes where a sun icon would be wrong
  // at night; everything else looks the same in the dark.
  it("swaps to a moon icon at night for clear skies only", () => {
    expect(lookupCondition(0, false).iconName).toBe("moon");
    expect(lookupCondition(1, false).iconName).toBe("moon");
    expect(lookupCondition(0, false).condition).toBe(
      lookupCondition(0, true).condition,
    );

    const rainyDay = lookupCondition(61, true);
    const rainyNight = lookupCondition(61, false);
    expect(rainyNight.iconName).toBe(rainyDay.iconName);
  });

  // An unmapped code must render something rather than undefined.
  it("falls back for unknown codes", () => {
    expect(lookupCondition(9999, true)).toEqual({
      condition: "Unknown",
      iconName: "cloud",
    });
  });
});

describe("weekdayShortFromIsoDate", () => {
  // Open-Meteo sends a bare YYYY-MM-DD. Parsed as UTC midnight it lands on the
  // previous day for anyone west of Greenwich — Cleveland included — so the
  // forecast would be labelled with the wrong weekday.
  it("uses local noon so the weekday cannot slip a day", () => {
    expect(weekdayShortFromIsoDate("2026-08-10")).toBe("MON");
    expect(weekdayShortFromIsoDate("2026-08-15")).toBe("SAT");
  });

  it("returns an empty string for unparseable input", () => {
    expect(weekdayShortFromIsoDate("")).toBe("");
    expect(weekdayShortFromIsoDate("not-a-date")).toBe("");
  });
});

describe("buildResponse", () => {
  const full = {
    current: {
      time: "2026-08-10T14:00",
      temperature_2m: 74.6,
      relative_humidity_2m: 55.2,
      apparent_temperature: 76.1,
      is_day: 1,
      weather_code: 0,
      wind_speed_10m: 8.7,
      wind_direction_10m: 190.4,
    },
    daily: {
      time: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"],
      weather_code: [0, 61, 3, 0],
      temperature_2m_max: [80.4, 78.9, 75.2, 79.0],
      temperature_2m_min: [61.2, 63.7, 60.1, 62.0],
      sunrise: ["2026-08-10T06:31"],
      sunset: ["2026-08-10T20:24"],
    },
  };

  it("maps a complete payload", () => {
    const r = buildResponse(full);
    expect(r.current.tempF).toBe(75);
    expect(r.current.feelsLikeF).toBe(76);
    expect(r.current.humidity).toBe(55);
    expect(r.current.windMph).toBe(9);
    expect(r.current.isDay).toBe(true);
    expect(r.current.observedAt).toBe("2026-08-10T14:00");
    expect(r.today).toEqual({
      highF: 80,
      lowF: 61,
      sunrise: "2026-08-10T06:31",
      sunset: "2026-08-10T20:24",
    });
  });

  // Index 0 is today and is reported separately; the strip shows the next two.
  it("returns exactly two upcoming days, starting from tomorrow", () => {
    const r = buildResponse(full);
    expect(r.upcoming).toHaveLength(2);
    expect(r.upcoming.map((d) => d.date)).toEqual(["2026-08-11", "2026-08-12"]);
    expect(r.upcoming[0]!.highF).toBe(79);
    expect(r.upcoming[0]!.weekday).toBe("TUE");
  });

  it("reports the Center's own coordinates, never the caller's", () => {
    const r = buildResponse(full);
    expect(r.location.name).toBeTruthy();
    expect(typeof r.location.latitude).toBe("number");
    expect(typeof r.location.longitude).toBe("number");
  });

  // The failure that matters: upstream changes shape, nothing throws, and the
  // widget shows a confident 0°F.
  it("survives a completely empty payload", () => {
    const r = buildResponse({});
    expect(r.current.tempF).toBe(0);
    expect(r.current.condition).toBeTruthy();
    expect(r.current.isDay).toBe(false);
    expect(r.today).toEqual({ highF: 0, lowF: 0, sunrise: "", sunset: "" });
    expect(r.upcoming).toEqual([]);
    expect(r.current.observedAt).not.toBe("");
  });

  it("survives a daily block with only today", () => {
    const r = buildResponse({
      current: full.current,
      daily: { time: ["2026-08-10"], temperature_2m_max: [80] },
    });
    expect(r.today.highF).toBe(80);
    expect(r.upcoming).toEqual([]);
  });

  it("treats a missing is_day as night rather than assuming daylight", () => {
    const r = buildResponse({ current: { weather_code: 0 } });
    expect(r.current.isDay).toBe(false);
    expect(r.current.iconName).toBe("moon");
  });
});
