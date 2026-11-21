-- Every source-backed acting appointment must point to the immutable event
-- that established it. Once populated, source rows remain append-only.
ALTER TABLE symphony.acting_officer_appointments
  ALTER COLUMN source_event_id SET NOT NULL;
