#include "scale.h"
#include "pds_config.h"
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
    // Default to PDS_DEFAULT_CALIBRATION_FACTOR if not set in NVS
    _calibrationFactor = prefs.getFloat(NVS_KEY_CAL_FACTOR, PDS_DEFAULT_CALIBRATION_FACTOR);
    if (prefs.isKey(NVS_KEY_TARE_OFFSET))
    {
        _hx711.set_offset(prefs.getLong(NVS_KEY_TARE_OFFSET, (long)PDS_DEFAULT_ZERO_RAW));
        _hasTareOffset = true;
    }
    else
    {
        _hx711.set_offset((long)PDS_DEFAULT_ZERO_RAW);
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
    const long tareAdjusted = _hx711.get_value(5);
    float grams = (float)tareAdjusted / _calibrationFactor;

    // Fluctuation cleanup per teammate configuration:
    // Remove tiny negative/zero fluctuations (-20 g to 0 g)
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

