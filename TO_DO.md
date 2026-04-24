* Analiza el fichero `ANNUAL_SIMULATION_ANALYSIS.md`

* En el apartado `Infrastructure (committed after validations pass)` de `ANNUAL_SIMULATION_ANALYSIS.md` están los ficheros que se han creado como base para este desarrollo

* Ya se han realizado los cambios necesarios para la validación de la fase 0 (en `src/_annual_simulation_validation`), se han ejecutado y este es el output, así que considero que es válida la solución y **se puede proceder con la "Phase 1"**

```
=== Phase 0 Validations ===

Running all Phase 0 validations. Check each section below.

[Phase 0] Validation 1 — BVH serialisation round-trip
  PASS — hit distance matches: 4.000000

[Phase 0] Validation 4 — IndexedDB round-trip
  PASS — write: 3.0 ms, read: 1.0 ms
  Cleanup: store cleared

[Phase 0] Validation 2 & 3 — Three.js + SunCalc in worker
  Three.js revision in worker: 183
  SunCalc available in worker: true
  PASS

[Phase 0] Validation 5 — Worker count heuristic
  navigator.hardwareConcurrency (worker): 32
  Recommended workers for 1 setup: 1
  Recommended workers for 3 setups: 3
  Recommended workers for 8 setups: 8
  PASS — review values above manually

=== Phase 0 complete — review each section above ===
```