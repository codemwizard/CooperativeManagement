/**
 * @symphony/testkit — step-definitions/world.ts
 *
 * Shared Cucumber World object. Provides test-scoped state shared between
 * step definitions within a scenario.
 *
 * Phase 0: Empty stub — no step definitions implemented yet.
 * All scenarios are tagged @wip and will be skipped by the BDD runner
 * until step definitions are implemented in Phase 1+.
 */

import { setWorldConstructor } from '@cucumber/cucumber';

export class SymphonyWorld {
  /**
   * Phase 0 stub — will hold: db client, actor identities,
   * command results, event log, fake clock, etc. in Phase 1.
   */
  constructor() {
    // No-op in Phase 0 scaffold
  }
}

setWorldConstructor(SymphonyWorld);

