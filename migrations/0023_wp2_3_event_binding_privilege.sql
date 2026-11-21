-- The source row is created with a NULL event reference because its RLS
-- WITH CHECK policy requires the referenced event to exist. CommandBus saves
-- the immutable event/outbox first, then binds this one provenance column in
-- the same transaction. Rollback still covers the entire operation.
GRANT UPDATE (source_event_id) ON symphony.capacity_grants TO symphony_app;
GRANT UPDATE (source_event_id) ON symphony.ta_scope_delegations TO symphony_app;
