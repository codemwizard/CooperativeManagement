/**
 * @symphony/testkit — step-definitions/world.ts
 *
 * Shared Cucumber World object. Provides test-scoped state shared between
 * step definitions within a scenario.
 *
 * Phase 1: Holds in-memory command results, event log, actor identities.
 */

import { setWorldConstructor } from '@cucumber/cucumber';
import type { CommandResult } from '@symphony/domain';
import type { Browser, BrowserContext, Page } from '@playwright/test';

export interface Actor {
  userId: string;
  tenantId: string;
  role: string;
}

export class SymphonyWorld {
  /** Live browser state is populated only by the dedicated WP6.1 Cucumber profile. */
  browser?: Browser;
  browserContext?: BrowserContext;
  page?: Page;
  baseUrl?: string;
  organizationId?: string;
  visitedRouteTexts: string[] = [];
  routeFocusResults: boolean[] = [];
  activePersona?: string;

  /** Named organisations registered in this scenario */
  organisations: Record<string, { id: string; tenantId: string }> = {};

  /** Named actors */
  actors: Record<string, Actor> = {};

  /** Current actor for the scenario */
  currentActor: Actor | null = null;

  /** Results of commands submitted in this scenario */
  commandResults: Map<string, CommandResult<unknown>> = new Map();

  /** Count of domain events emitted (by aggregate id) */
  eventCounts: Map<string, number> = new Map();

  /** Last rejection reason */
  lastRejectionReason: string | null = null;

  /** Last command id submitted */
  lastCommandId: string | null = null;

  constructor() {
    // Initialised above via field declarations
  }
}

setWorldConstructor(SymphonyWorld);
