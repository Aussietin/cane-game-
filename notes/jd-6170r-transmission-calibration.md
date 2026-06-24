# JD 6170R Powershift Transmission Calibration — 24 June 2026

## Tractor

- **Model:** John Deere 6170R
- **Hours:** ~6352
- **Operator:** Austin (Racecourse Projects, North Queensland)

## Display / Software

| Item | Detail |
|------|--------|
| Display | CommandCenter (GreenStar GS-2.31, VT App Build 02.31.1142) |
| Display Hardware | RE337171E.1 / Serial 218954 |
| Software | PFA11134 v01.00 |

## Reason for Calibration

Post transmission oil and filter change.

## Procedure

Manual reference: **PTQ 038 Transmission Calibration** (JD Worldwide Edition — PTQ 037/038)

## Problem

PTQ.001 device and diagnostic addresses PTQ 037/038 are not appearing in:

> Message Center > Diagnostic Addresses

### What was tried

- Navigated Message Center > Diagnostic Addresses — no PTQ device listed
- Checked PDU.001 — no matching addresses
- Confirmed device list shows: NAV, OGM, OIC, PDU, PTQ (different addresses), PrF, RAD, RLC, RPT, SMV
- Note: PTQ.001 does appear in the device list but addresses 037/038 are not available within it

## Current Status (24 June 2026)

- Dealer (JD) sent correct manual section (PTQ 038) ✓
- Austin has messaged dealer asking about program/deeper diagnostic mode
- **Awaiting dealer response**
- Transmission oil temp currently ~40°C — needs to reach **55–70°C** for calibration to run

## Outstanding Questions for Dealer

1. How to enter program/diagnostic mode to access PTQ 037/038
2. Whether a software update is required on the transmission controller
3. Whether GS-2.31 display software version is relevant to the missing addresses

## Next Steps (when dealer responds)

- Confirm if deeper diagnostic mode is needed (and how to access it)
- Warm oil to 55–70°C before attempting calibration
- Follow PTQ 038 procedure once addresses are accessible
