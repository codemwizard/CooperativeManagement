/**
 * Feature 10 acceptance is intentionally fail-closed until the WP6.1 live
 * browser/API/PostgreSQL runner is implemented. The former steps asserted
 * source text and copied presenter output, which could report active UXW
 * scenarios as passing without exercising the product.
 */

import { Given } from '@cucumber/cucumber';

Given('the workspace is running with seed data in test mode', function () {
  throw new Error(
    'WP6.1 BDD acceptance requires the live served workspace, persisted WP5.3 session, and isolated PostgreSQL fixture; source-only acceptance is disabled.',
  );
});
