-- Trigger execution is internal to PostgreSQL; runtime clients must not be
-- able to invoke the guard functions directly.
REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_source_owner()
  FROM PUBLIC, symphony_app;
REVOKE ALL ON FUNCTION symphony.enforce_acting_appointment_immutability()
  FROM PUBLIC, symphony_app;
