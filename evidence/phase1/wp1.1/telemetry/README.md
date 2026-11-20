# BDD-AUD-007 live telemetry evidence

`cucumber-report.json` and `cucumber-run.log` record the live browser scenario. `cucumber-api-redacted.log` records the associated API server output.

The browser emits only a fixed event name, an allowlisted screen category, and an event timestamp. It omits the URL, query string, cooperative identifier, account identifier, and member data. The scenario signs in through the persisted WP5.3 session, navigates to Evidence register and Overview, checks the telemetry event stream, and confirms PostgreSQL's business event count for the fixture tenant did not change.

The evidence is local test-mode acceptance. It does not claim a configured external analytics destination, retention policy, or production telemetry deployment.
