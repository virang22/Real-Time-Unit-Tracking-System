# Gujarat DISCOM tariff configuration

`gujarat-discom-tariffs.json` contains the GERC tariff schedule for the four state-owned DISCOMs, effective 1 April 2026. The `RGP` and `RGP_RURAL` slab and connected-load fixed-charge values are taken from the official schedule linked by `sourceUrl`.

Bill generation stays disabled until the current non-tariff utility charges are configured from the applicable DISCOM notice or bill:

- `utilityCharges.fppasPerKwh`: current FPPAS in INR/kWh.
- `utilityCharges.electricityDutyPercentByProfile`: all four consumer-profile duty percentages.
- `utilityCharges.electricityDutyBasis`: `ENERGY_CHARGES` or `ENERGY_AND_FPPAS`, according to the governing duty calculation.

Use numeric zero only when an authoritative current notice says the charge is zero. The backend reads this file for each tariff/configuration request, so changes do not require a code edit.