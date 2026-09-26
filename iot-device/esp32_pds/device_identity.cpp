#include "device_identity.h"

// "ESP32-" + 6 hex chars + NUL.
static char deviceIdBuffer[13] = {0};

const char* pdsDeviceId() {
    if (deviceIdBuffer[0] != '\0') {
        return deviceIdBuffer; // computed once, then cached
    }

    // ESP.getEfuseMac() calls esp_efuse_mac_get_default(), which writes the six
    // MAC octets in printed order into the low bytes of the uint64 (octet 0 in
    // bits 0-7, octet 5 in bits 40-47 on this little-endian core). Extracting
    // them back out by shift keeps this independent of struct layout, and
    // avoids pulling in <esp_mac.h>, whose location moved between Arduino-ESP32
    // core 2.x and 3.x.
    const uint64_t mac = ESP.getEfuseMac();
    const uint8_t octet3 = (uint8_t)((mac >> 24) & 0xFF);
    const uint8_t octet4 = (uint8_t)((mac >> 32) & 0xFF);
    const uint8_t octet5 = (uint8_t)((mac >> 40) & 0xFF);

    // The last three octets: the OUI (first three) is identical across every
    // Espressif board and would carry no information.
    snprintf(deviceIdBuffer, sizeof(deviceIdBuffer), "ESP32-%02X%02X%02X", octet3, octet4, octet5);
    return deviceIdBuffer;
}
