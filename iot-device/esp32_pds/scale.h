#pragma once
#include <Arduino.h>
#include <HX711.h>

// HX711 wrapper. calibration_factor is persisted to NVS (via Preferences) so
// it survives reboots/power loss — run the calibration procedure in
// README.md at least once before trusting readGrams().
class Scale
{
public:
    void begin(uint8_t dtPin, uint8_t sckPin);
    void tare();
    void setCalibrationFactor(float factor); // also persists to NVS
    float getCalibrationFactor() const { return _calibrationFactor; }
    bool hasTareOffset() const { return _hasTareOffset; }
    bool isReady();
    int readGrams();                                    // applies calibration_factor + tare offset, rounds to nearest integer gram
    long readRawAverage(uint8_t samples = 10);          // raw ADC counts before tare offset and calibration
    long readTareAdjustedAverage(uint8_t samples = 10); // standard HX711 get_value() result, before scale factor

private:
    HX711 _hx711;
    float _calibrationFactor = 1.0f;
    bool _hasTareOffset = false;
    void loadCalibrationFactor();
};
