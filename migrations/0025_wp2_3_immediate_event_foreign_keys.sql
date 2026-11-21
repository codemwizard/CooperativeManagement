-- Event references are attached by the same transaction after the repository
-- has inserted the event. They can therefore remain immediate constraints,
-- avoiding deferred trigger queues on the shared append-only event table.
ALTER TABLE symphony.capacity_grants
  DROP CONSTRAINT capacity_grants_source_event_id_fkey,
  DROP CONSTRAINT capacity_grants_revoked_event_id_fkey,
  ADD CONSTRAINT capacity_grants_source_event_id_fkey
    FOREIGN KEY (source_event_id) REFERENCES symphony.domain_events(id),
  ADD CONSTRAINT capacity_grants_revoked_event_id_fkey
    FOREIGN KEY (revoked_event_id) REFERENCES symphony.domain_events(id);

ALTER TABLE symphony.ta_scope_delegations
  DROP CONSTRAINT ta_scope_delegations_source_event_id_fkey,
  DROP CONSTRAINT ta_scope_delegations_revoked_event_id_fkey,
  ADD CONSTRAINT ta_scope_delegations_source_event_id_fkey
    FOREIGN KEY (source_event_id) REFERENCES symphony.domain_events(id),
  ADD CONSTRAINT ta_scope_delegations_revoked_event_id_fkey
    FOREIGN KEY (revoked_event_id) REFERENCES symphony.domain_events(id);
