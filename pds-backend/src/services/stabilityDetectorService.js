const {
    STABILITY_MIN_READINGS,
    STABILITY_WINDOW_MS,
    STABILITY_MAX_SPREAD_GRAMS,
} = require("../config/iot");

// Keeps only readings within the last `windowMs` of `nowMs`. Readings must
// have a numeric `takenAtMs` field (epoch ms).
const filterToWindow = (readings, nowMs, windowMs = STABILITY_WINDOW_MS) =>
    readings.filter((reading) => nowMs - reading.takenAtMs <= windowMs);

// Pure evaluation of the auto-confirm rule against an already-windowed set
// of readings (see filterToWindow above) — no time-dependence, so this is
// directly unit-testable: stable iff the window has enough readings, they're
// tightly clustered, and their mean sits within tolerance of what's expected.
const isStable = (windowReadings, entitledGrams, toleranceGrams) => {
    if (!Array.isArray(windowReadings) || windowReadings.length < STABILITY_MIN_READINGS) {
        return false;
    }

    const values = windowReadings.map((reading) => reading.gramsInt);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    return (max - min) <= STABILITY_MAX_SPREAD_GRAMS && Math.abs(mean - entitledGrams) <= toleranceGrams;
};

module.exports = { isStable, filterToWindow };
