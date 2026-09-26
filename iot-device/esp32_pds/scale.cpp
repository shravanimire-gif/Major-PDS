#include "scale.h"
#include <Preferences.h>

namespace
{
    const char *NVS_NAMESPACE = "scale";
    const char *NVS_KEY_CAL_FACTOR = "cal_factor";
    const char *NVS_KEY_TARE_OFFSET = "tare_offset";
}

void Scale::begin(uint8_t dtPin, uint8_t sckPin)
{
    _hx711.begin(dtPin, sckPin);
    loadCalibrationFactor();
    _hx711.set_scale(_calibrationFactor);
}

void Scale::loadCalibrationFactor()
{
    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, /* readOnly = */ true);
    // Defaults to 1.0 (i.e. uncalibrated) until setCalibrationFactor() has
    // been called at least once — see the README's calibration procedure.
    _calibrationFactor = prefs.getFloat(NVS_KEY_CAL_FACTOR, 1.0f);
    if (prefs.isKey(NVS_KEY_TARE_OFFSET))
    {
        _hx711.set_offset(prefs.getLong(NVS_KEY_TARE_OFFSET, 0));
        _hasTareOffset = true;
    }
    prefs.end();
}

void Scale::setCalibrationFactor(float factor)
{
    _calibrationFactor = factor;
    _hx711.set_scale(_calibrationFactor);

    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, /* readOnly = */ false);
    prefs.putFloat(NVS_KEY_CAL_FACTOR, factor);
    prefs.end();
}

void Scale::tare()
{
    _hx711.tare();

    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, /* readOnly = */ false);
    prefs.putLong(NVS_KEY_TARE_OFFSET, _hx711.get_offset());
    prefs.end();
    _hasTareOffset = true;
}

bool Scale::isReady()
{
    return _hx711.is_ready();
}

long Scale::readRawAverage(uint8_t samples)
{
    return _hx711.read_average(samples);
}

long Scale::readTareAdjustedAverage(uint8_t samples)
{
    // get_value() is the HX711 library's standard tare-adjusted calibration
    // input: raw average minus the offset captured by tare().
    return _hx711.get_value(samples);
}

int Scale::readGrams()
{
    // Keep the signed raw-count-to-gram conversion explicit. The calibration
    // factor can be negative when the load-cell signal polarity is reversed;
    // raw counts and factor then have the same sign and the result is still a
    // positive physical weight.
    const long tareAdjusted = _hx711.get_value(5);
    const float grams = (float)tareAdjusted / _calibrationFactor;
    return (int)round(grams);
}
