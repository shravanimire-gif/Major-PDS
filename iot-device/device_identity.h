#pragma once
#include <Arduino.h>

// The device's STABLE identity, derived from the ESP32's factory-programmed
// eFuse MAC address. Format: ESP32-XXXXXX, where XXXXXX is the last three
// octets of the chip's MAC in uppercase hex (e.g. ESP32-A1B2C3).
//
// WHY MAC-DERIVED, AND WHY NOT A COM PORT
// The identity has to survive things a demo actually does: reflashing the
// sketch, unplugging and replugging the board, plugging it into a different USB
// socket, rebooting the PC. A COM port survives none of those — Windows
// assigns COM3/COM5/COM11 from its own USB enumeration order, so it describes
// the cable, not the board. The eFuse MAC is burned at the factory, is unique
// per chip, and is readable without WiFi being initialised or even compiled in.
//
// This is the value registered as iot_devices.device_id and the value the
// bridge presents at the /ws/iot handshake, so the physical board and the
// database row refer to the same thing by construction. It is an IDENTIFIER,
// not a credential: it travels in a URL query parameter and is printed in
// logs. Authorisation is the device token, held by the bridge.
//
// Nothing here is configurable on purpose. A firmware-settable device_id would
// let two boards claim one identity, and the backend's device -> shop -> session
// binding would then be resolving the wrong hardware.
const char* pdsDeviceId();
