# Event-Boundary Evaluation Timing

AIOpsLab currently exposes `TTD`, `TTL`, `TTA`, and `TTM` from the session duration. That duration is useful for backward compatibility, but it does not by itself identify the benchmark lifecycle boundaries described by the research-aligned timing model.

This PoW adds event instrumentation without changing the historical metric fields yet.

## Canonical boundaries

| Event | Meaning |
|---|---|
| `fault_occurred` | Fault injection has completed and the fault is active. |
| `detection_completed` | A valid detection submission has been accepted. |
| `localization_completed` | A valid localization submission has been accepted. |
| `analysis_completed` | A valid RCA/analysis submission has been accepted. |
| `mitigation_completed` | Mitigation has reached an oracle-confirmed completion point. |

## Derived intervals

The intended event-boundary model is:

- `TTD = detection_completed - fault_occurred`
- `TTL = localization_completed - fault_occurred`
- `TTA = analysis_completed - fault_occurred`
- `TTM = mitigation_completed - detection_completed`

The last four formulas are treated as the PoW target model; the primary AIOpsLab research source explicitly establishes TTD and TTM, while TTL/TTA remain operational extensions until independently sourced.

## Compatibility rule

Existing result fields are not rewritten by this PoW. Historical session-duration values remain valid as historical/legacy measurements. New event timestamps are persisted separately so a later PR can migrate the metric fields only after regression coverage demonstrates that all benchmark task types expose the required boundaries.

No-op problems must not be interpreted as instantaneous fault detection merely because a session duration exists; future metric migration should represent the absence of a fault boundary explicitly.
