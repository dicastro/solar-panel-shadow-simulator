* Este es el output de la validación de la fase 0

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

* Añadir más validaciones sobre la configuración
  * Que el count de los railing sea mínimo 2