#include "HX711.h"

// Pin Definitions
#define DT 5
#define SCK 18

HX711 scale;

// Calibration & Limits Configuration (Teammate Configs)
const float ZERO_RAW = -27536.5f;
const float CALIBRATION_FACTOR = -397715.2f;
const float MAX_WEIGHT_KG = 5.0f;

void setup() {
  Serial.begin(115200);
  delay(1000);
  scale.begin(DT, SCK);
  Serial.println("================================");
  Serial.println("PDS WEIGHT SENSOR");
  Serial.println("Range: 0 - 5 KG");
  Serial.println("================================");
  delay(2000);
}

void loop() {
  if (!scale.is_ready()) {
    Serial.println("HX711 NOT READY!");
    delay(1000);
    return;
  }

  long rawValue = scale.read_average(10);
  float weightKg = (rawValue - ZERO_RAW) / CALIBRATION_FACTOR;
  float weightGrams = weightKg * 1000.0f;

  // Remove tiny negative/zero fluctuations
  if (weightGrams < 0 && weightGrams > -20.0f) {
    weightGrams = 0.0f;
    weightKg = 0.0f;
  }
  if (weightGrams < 0) {
    weightGrams = 0.0f;
    weightKg = 0.0f;
  }

  // Maximum 5 kg limit
  if (weightKg > MAX_WEIGHT_KG) {
    weightKg = MAX_WEIGHT_KG;
    weightGrams = 5000.0f;
  }

  Serial.print("Raw: ");
  Serial.print(rawValue);
  Serial.print("    Weight: ");
  Serial.print(weightGrams, 1);
  Serial.print(" g");
  Serial.print("    ");
  Serial.print(weightKg, 3);
  Serial.println(" kg");

  delay(1000);
}
