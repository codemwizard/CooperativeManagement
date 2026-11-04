# Scenario Contract Catalogue

| ID | Given | When | Expected |
|---|---|---|---|
| SC-001 | Self-enroller lacks cooperative authority | handover attempted | reject; enrollment unchanged |
| SC-002 | Appointment has no authority source | activation attempted | reject |
| SC-003 | Certificate lists former officers | current roster derived | no appointment inferred |
| SC-004 | Former appointment has ended | replacement appointed | history retained; new interval starts |
| SC-005 | Exclusive position has active appointment | overlapping appointment attempted | reject |
| SC-006 | By-law has no registration/effectiveness proof | marked effective | reject |
| SC-007 | Minutes already submitted | correction submitted | new version; prior version preserved |
| SC-008 | Minutes not approved | resolution adoption attempted | reject |
| SC-009 | Evidence v1 has finding | evidence v2 submitted | v2 unverified |
| SC-010 | Supplier submitted evidence | supplier verifies | reject |
| SC-011 | Two versions exist | finding recorded for v1 | v2 unaffected |
| SC-012 | Evidence admitted | assurance queried | not automatically approved/verified |
| SC-013 | Evidence has open dispute | unqualified reliance requested | block |
| SC-014 | Prior validation exists | new evaluation runs | old snapshot unchanged |
| SC-015 | Referenced record is other tenant's | command submitted | reject |
| SC-016 | Idempotency receipt exists | same command retried | original result; no duplicate event |
| SC-017 | Aggregate version advanced | stale expected version submitted | reject concurrency conflict |
| SC-018 | Command commits | transaction inspected | state, event and outbox all present |
| SC-019 | Institutional actor is read-only | source mutation attempted | reject |
| SC-020 | Governance requirement is unknown/vacant | profile configured | record unknown/vacancy; no compliance claim |
