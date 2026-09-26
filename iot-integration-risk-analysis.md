# IoT Integration Risk Analysis Under a 5 kg Load-Cell Constraint

## Executive summary

The system is already partially hardened against the 5 kg hardware limit:

- the business rule caps one commodity allocation at 4000 g in [pds-backend/src/config/allocation.js](pds-backend/src/config/allocation.js)
- the hardware safety rule caps credible readings at 5000 g in [pds-backend/src/config/iot.js](pds-backend/src/config/iot.js)
- the firmware mirrors the same 5000 g limit in [iot-device/pds_config.h](iot-device/pds_config.h)
- the database migration in [pds-backend/migrations/023_per_card_allocation_grams.js](pds-backend/migrations/023_per_card_allocation_grams.js) consciously fixes the historical bug where per-person entitlement could create >4 kg wallet balances

That means the worst-case design flaw has already been corrected in code. The remaining inconsistencies are mostly latent risks that appear when old data, UI assumptions, or mixed unit conventions are combined with live IoT weighing.

In practical terms, the system is safe only if all of these stay true at once:

1. no policy or wallet exceeds the single-transaction business ceiling of 4000 g
2. no physical device frame above 5000 g is treated as a valid measurement
3. every path that displays or inputs weight uses grams consistently at the device boundary
4. the UI never allows a manual quantity or a legacy wallet value to exceed the 5 kg physical ceiling

If any one of those is violated, IoT integration will fail in a way that looks like a dispensing bug, even though the root cause is a mismatch between business rules, hardware limits, and data assumptions.

---

## 1. What the system already considers a valid boundary

The repository explicitly defines three different ceilings, and they must not be mixed together:

| Limit | Meaning | Source |
|---|---|---|
| 4000 g | business allocation ceiling for one commodity in one session | [pds-backend/src/config/allocation.js](pds-backend/src/config/allocation.js) |
| 5000 g | hardware safety ceiling for the load cell | [pds-backend/src/config/iot.js](pds-backend/src/config/iot.js), [iot-device/pds_config.h](iot-device/pds_config.h) |
| tolerance range (~20 g to 50 g depending on commodity) | acceptable measurement deviation for a fulfilled dispense | [pds-backend/src/services/dispenseSessionService.js](pds-backend/src/services/dispenseSessionService.js) |

This separation is important because:

- 4500 g is physically safe and business-invalid
- 5100 g is hardware-invalid and must be rejected
- tolerance is not a permission to dispense more grain; it is only a measurement acceptance band

The same distinction is documented in [iot-device/README_USB_SERIAL.md](iot-device/README_USB_SERIAL.md).

---

## 2. The real inconsistency: the system had three different “meaning of weight” models

### 2.1 Business layer uses kg semantics

The wallet and ration-card policy model is expressed in kg for balances and in grams for per-card allocations.

Examples:

- wallets store `rice_balance_kg` / `wheat_balance_kg` in [schema.sql](schema.sql)
- a 5 kg wallet is represented as `5` in the UI and seeded test data, e.g. [pds-frontend/e2e/seed.js](pds-frontend/e2e/seed.js)
- the policy migration changes values from per-person kg to per-card grams in [pds-backend/migrations/023_per_card_allocation_grams.js](pds-backend/migrations/023_per_card_allocation_grams.js)

This is fine for reporting, but it creates a hidden risk: a user or script can think in kg while the physical scale is producing gram frames.

### 2.2 IoT layer uses grams only

The device emits raw gram readings and rejects anything above the load-cell rating. See:

- [iot-device/pds_config.h](iot-device/pds_config.h)
- [pds-backend/src/config/iot.js](pds-backend/src/config/iot.js)
- [pds-backend/src/ws/iotSocketServer.js](pds-backend/src/ws/iotSocketServer.js)

The commit logic in [pds-backend/src/services/dispenseSessionService.js](pds-backend/src/services/dispenseSessionService.js) compares a measured weight against `entitled_grams` in the same unit, and it rejects out-of-tolerance values before committing.

That is correct, but it means the UI and DB must be disciplined about unit boundaries. If a user sees a 5 kg wallet and enters 5 in the UI, but the backend resolves the session for 4000 g, the system can start mixing “displayed wallet size” with “actual dispensed entitlement” and create false confidence at the shop floor.

### 2.3 Historical entitlement logic used a per-person model that could exceed the 5 kg device limit

This was the actual design bug the migration fixed.

The migration notes in [pds-backend/migrations/023_per_card_allocation_grams.js](pds-backend/migrations/023_per_card_allocation_grams.js) explicitly say the old model could produce wallet balances as high as 45 kg rice and 48 kg wheat. That is incompatible with the 5 kg cell because a single live dispensing transaction cannot physically complete on a 5 kg-rated scale.

This is the clearest example of an integration inconsistency: the old business model was keeping family-size totals in kg, but the physical device would only ever deliver an allocation smaller than the cell capacity in a single pass.

---

## 3. Inconsistencies that can still trigger after IoT integration

### 3.1 The “three ceilings” are easy to confuse

The repo does a good job naming these separately, but the operational risk remains severe because all the values are near each other:

- 4000 g business ceiling
- 5000 g hardware ceiling
- 50 g tolerance band

If someone reuses a 5 kg wallet into a manual “quantity” field without validating it against the entitlement, the system can produce a visually valid UI flow while the physical cell rejects or saturates it.

This risk is especially high because the UI and tests still use values like “5” and “5000 g” in the e2e path, as seen in [pds-frontend/e2e/dispense-iot.spec.js](pds-frontend/e2e/dispense-iot.spec.js) and [pds-frontend/e2e/seed.js](pds-frontend/e2e/seed.js).

### 3.2 Legacy or manually inserted records can silently reintroduce the problem

The migration fixed the DB logic, but the system still depends on all environments being migrated or re-seeded consistently.

If an older database still has `rice_per_person_kg` style values or a wallet balance above 4-5 kg, the following will happen:

- a session may be opened for a value larger than the hardware can practically measure
- the device will report an overload or invalid frame above 5000 g
- the backend will reject the frame as out-of-range, and the session state becomes terminal or fails at commit time

This is the real “after IoT integration” trap: the code may be fixed, while a stale database or manual seed causes the same failure pattern as the original design bug.

### 3.3 Display unit mismatch between kg and grams

This is a subtle but persistent consistency problem.

- business balances are shown in kg
- scale readings are sent in grams
- tolerance and allocation checks operate on grams, not kg
- database comparisons and device checks all happen in grams at the commit boundary

This means there are multiple layers with different units and the risk of a translation mistake is high. A 5 kg wallet can look like a safe “100% full” scale, while the device is actually holding a 5000 g reading at the hardware boundary and the backend is still doing strict gram-level comparisons.

### 3.4 Near-limit operation creates false confidence during calibration and stability checks

The firmware intentionally trips at the hardware ceiling and clears just below it, as defined in [iot-device/pds_config.h](iot-device/pds_config.h).

So a load cell at or near 5000 g is operating at the edge of its safe range. Any extra jitter, calibration drift, or out-of-tolerance measurement can be misread as a legitimate dispense. The system reduces this risk by rejecting readings beyond the hardware ceiling and by requiring stable readings before commit, but only when the device is correctly calibrated and the data path is normalized.

### 3.5 Manual fallback remains a danger if input is not constrained to the entitlement

The manual path is still conceptually independent of the IoT path in [pds-backend/src/controllers/shopkeeperController.js](pds-backend/src/controllers/shopkeeperController.js), but the IoT path’s logic is intentionally more structured.

The danger is not the hardware itself; it is that a manual path can still accept a quantity that conflicts with the session’s authoritative entitlement. If the UI shows a 5 kg wallet and the user keys in 5.0 kg instead of the narrower entitlement, the backend must reject it.

The repo already addresses this in [pds-backend/src/services/dispenseSessionService.js](pds-backend/src/services/dispenseSessionService.js) by deriving the allocation from the authoritative policy and rejecting partial or mismatched values. That protects the IoT path—but any manual UI or legacy caller that bypasses this check can still trigger a bad state.

---

## 4. System-level conclusion

The 5 kg load cell is not inherently incompatible with the PDS design, because the business allocation ceiling is already set lower at 4000 g. The integration is safe only if the system preserves this invariant everywhere:

- hardware ceiling: 5000 g maximum credible reading
- business ceiling: 4000 g maximum single-commodity entitlement
- tolerance: a small measurement band, not an increase in quantity
- unit model: grams on the device boundary, kilograms only in reporting and wallet display

The actual inconsistencies that can trigger after IoT integration are therefore not “the 5 kg cell is wrong.” They are:

1. legacy database values or manual inserts that exceed the 4 kg business ceiling
2. unit drift between kg and grams across UI, DB and physical sensor frames
3. confusion between allowed quantity, entitled amount, and measured device weight
4. stale or offline device state plus a live session that still expects weighing
5. lack of strict UI validation when the shopkeeper sees a 5 kg wallet balance

The repo already contains the key hardening measures needed to avoid most of these issues, especially in [pds-backend/migrations/023_per_card_allocation_grams.js](pds-backend/migrations/023_per_card_allocation_grams.js), [pds-backend/src/config/allocation.js](pds-backend/src/config/allocation.js), [pds-backend/src/config/iot.js](pds-backend/src/config/iot.js), and [pds-backend/src/services/dispenseSessionService.js](pds-backend/src/services/dispenseSessionService.js).

---

## 5. Recommended operating rules for the field

1. Treat 5 kg as a hard hardware ceiling, never as a business entitlement.
2. Keep every single commodity entitlement at or below 4000 g.
3. Reject any reading above 5000 g and never persist it.
4. Keep device readings in grams and wallet balances in kg only at presentation boundaries.
5. Run the migration before enabling live IoT weighing on a production database.
6. Ensure the shopkeeper UI never accepts a manual quantity beyond the authorized session entitlement.
7. Keep the one-device-per-shop and active-device checks enforced before a weighing session begins.

---

## 6. Bottom line

The system is aligned with the 5 kg cell only after the business model was reduced to per-card, one-transaction allocations and the device boundary was capped at 5000 g. The remaining risk is not the sensor itself; it is architectural drift between old entitlement assumptions, UI conventions, and the hardware reality of an ESP32 + HX711 + 5 kg strain gauge.

That drift is exactly the kind of issue that appears only after IoT integration is turned on, which is why the repo’s migration and validation layers are essential.
