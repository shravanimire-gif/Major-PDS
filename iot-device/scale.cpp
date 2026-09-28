#include "scale.h"
#include "pds_config.h"
#include <Preferences.h>

namespace
{
    const char *NVS_NAMESPACE = "scale";
    const char *NVS_KEY_CAL_FACTOR = "cal_factor";
}

void Scale::begin(uint8_t dtPin, uint8_t sckPin)
{
    _hx711.begin(dtPin, sckPin);
    loadCalibrationFactor();
    _hx711.set_scale(_calibrationFactor);
    _hx711.set_offset((long)PDS_DEFAULT_ZERO_RAW);
}

void Scale::loadCalibrationFactor()
{
    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, /* readOnly = */ true);
    _calibrationFactor = prefs.getFloat(NVS_KEY_CAL_FACTOR, PDS_DEFAULT_CALIBRATION_FACTOR);
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
    float grams = _hx711.get_units(5);
    if (grams < 0 && grams > -20.0f)
    {
        grams = 0.0f;
    }
    if (grams < 0)
    {
        grams = 0.0f;
    }
    if (grams > PDS_LOAD_CELL_RATED_GRAMS)
    {
        grams = (float)PDS_LOAD_CELL_RATED_GRAMS;
    }
    return (int)round(grams);
}

