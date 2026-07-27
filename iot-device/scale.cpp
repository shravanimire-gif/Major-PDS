#include "scale.h"
#include <Preferences.h>

namespace {
    const char* NVS_NAMESPACE = "scale";
    const char* NVS_KEY_CAL_FACTOR = "cal_factor";
}

void Scale::begin(uint8_t dtPin, uint8_t sckPin) {
    _hx711.begin(dtPin, sckPin);
    loadCalibrationFactor();
    _hx711.set_scale(_calibrationFactor);
}

void Scale::loadCalibrationFactor() {
    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, /* readOnly = */ true);
    // Defaults to 1.0 (i.e. uncalibrated) until setCalibrationFactor() has
    // been called at least once — see the README's calibration procedure.
    _calibrationFactor = prefs.getFloat(NVS_KEY_CAL_FACTOR, 1.0f);
    prefs.end();
}

void Scale::setCalibrationFactor(float factor) {
    _calibrationFactor = factor;
    _hx711.set_scale(_calibrationFactor);

    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, /* readOnly = */ false);
    prefs.putFloat(NVS_KEY_CAL_FACTOR, factor);
    prefs.end();
}

void Scale::tare() {
    _hx711.tare();
}

bool Scale::isReady() {
    return _hx711.is_ready();
}

long Scale::readRawAverage(uint8_t samples) {
    return _hx711.read_average(samples);
}

int Scale::readGrams() {
    // get_units() averages a few raw samples and applies both the tare
    // offset and calibration_factor set above.
    float grams = _hx711.get_units(5);
    return (int)round(grams);
}
