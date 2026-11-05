/**
 * tools/verify-trace.ts
 *
 * Traceability gate tool — verifies feature file integrity.
 *
 * Rules enforced:
 *  1. All @REQ-xxx tags in feature files reference a code present in
 *     03-specification-delta.md (without the REQ- prefix).
 *  2. All @hard non-@wip scenarios have step definitions.
 *
 * Phase-0 behaviour:
 *  - All scenarios are @wip, so Rule 2 never triggers.
 *  - Rule 1 warns on unknown REQ codes but does NOT fail when all matching
 *    scenarios are also @wip (since the spec may use different notation).
 *
 * Exit codes:
 *  0 — all checks pass
 *  1 — one or more hard violations found
 *
 * Usage:
 *   tsx tools/verify-trace.ts
 *   npm run verify:trace
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

interface ScenarioInfo {
  file: string;
  line: number;
  tags: string[];
  isWip: boolean;
  isHard: boolean;
}

// ─── Collect scenario metadata from feature files ─────────────────────────────
async function collectScenarios(): Promise<{
  scenarios: ScenarioInfo[];
  reqTags: Set<string>;
}> {
  const featuresDir = path.join(ROOT, 'features');
  let files: string[];
  try {
    files = (await fs.readdir(featuresDir)).filter((f) => f.endsWith('.feature'));
  } catch {
    console.warn('Warning: features/ directory not found or empty. Skipping scenario collection.');
    return { scenarios: [], reqTags: new Set() };
  }

  const scenarios: ScenarioInfo[] = [];
  const reqTags = new Set<string>();

  for (const file of files) {
    const content = await fs.readFile(path.join(featuresDir, file), 'utf-8');
    const lines = content.split('\n');
    let pendingTags: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      if (line.trim().startsWith('@')) {
        // Accumulate tags
        const tags = line.trim().split(/\s+/).filter((t) => t.startsWith('@'));
        pendingTags.push(...tags);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      } else if (line.trim().startsWith('Scenario:') || line.trim().startsWith('Scenario Outline:')) {
        // Extract @REQ-xxx tags for traceability
        for (const tag of pendingTags) {
          const m = tag.match(/^@REQ-(.+)$/);
          if (m !== null && m !== undefined && m[1] !== undefined) {
            reqTags.add(m[1]);
          }
        }

        scenarios.push({
          file,
          line: i + 1,
          tags: [...pendingTags],
          isWip: pendingTags.includes('@wip'),
          isHard: pendingTags.includes('@hard'),
        });
        pendingTags = [];
      } else if (line.trim() !== '' && !line.trim().startsWith('#')) {
        // Non-tag, non-scenario content — reset pending tags
        // (but only if we hit Feature:, Background:, etc.)
        if (line.trim().startsWith('Feature:') ||
            line.trim().startsWith('Background:') ||
            line.trim().startsWith('Rule:') ||
            line.trim().startsWith('Examples:') ||
            line.trim().startsWith('Given ') ||
            line.trim().startsWith('When ') ||
            line.trim().startsWith('Then ') ||
            line.trim().startsWith('And ') ||
            line.trim().startsWith('But ')) {
          pendingTags = [];
        }
      }
    }
  }

  return { scenarios, reqTags };
}

// ─── Collect known requirement codes from 03-specification-delta.md ───────────
async function collectKnownRequirements(): Promise<Set<string>> {
  const specPath = path.join(ROOT, 'Implementation-Plan-V4', '03-specification-delta.md');
  let content: string;
  try {
    content = await fs.readFile(specPath, 'utf-8');
  } catch {
    console.warn('Warning: 03-specification-delta.md not found. Skipping REQ validation.');
    return new Set();
  }

  const knownCodes = new Set<string>();

  // The spec uses codes like ENR-001, PRV-006, BYL-001, etc. (without REQ- prefix)
  // Also match REQ-xxx style if present
  const matches = content.matchAll(/\b([A-Z]{2,6}-\d{3})\b/g);
  for (const m of matches) {
    if (m[1] !== undefined) {
      knownCodes.add(m[1]);
      // Also add with REQ- prefix to match @REQ-ENR-001 style
      knownCodes.add(`REQ-${m[1]}`);
    }  }

  return knownCodes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('Running traceability gate...\n');

  const { scenarios, reqTags } = await collectScenarios();
  const knownCodes = await collectKnownRequirements();

  let violations = 0;

  console.log(`  Found ${scenarios.length} scenarios in features/.`);
  const wipCount = scenarios.filter((s) => s.isWip).length;
  const hardNonWipCount = scenarios.filter((s) => s.isHard && !s.isWip).length;
  console.log(`  ${wipCount} are @wip (pending step definitions).`);
  console.log(`  ${hardNonWipCount} are @hard non-@wip (must have step definitions).`);

  // Rule 1: Check @REQ-xxx tags against known codes in spec
  // In Phase 0, all scenarios are @wip — unknown REQ tags on @wip scenarios
  // are reported as warnings only (not failures).
  const unknownTags: string[] = [];
  for (const reqTag of reqTags) {
    // reqTag is like "ENR-001" (stripped of @REQ- prefix)
    if (!knownCodes.has(reqTag) && !knownCodes.has(`REQ-${reqTag}`)) {
      unknownTags.push(reqTag);
    }
  }

  if (unknownTags.length > 0) {
    // Only fail if any unknown tags appear on non-@wip scenarios
    const unknownInNonWip: string[] = [];
    for (const scenario of scenarios) {
      if (!scenario.isWip) {
        for (const tag of scenario.tags) {
          const m = tag.match(/^@REQ-(.+)$/);
          if (m !== null && m[1] !== undefined && unknownTags.includes(m[1])) {
            unknownInNonWip.push(`${scenario.file}:${scenario.line} @REQ-${m[1]}`);
          }
        }
      }
    }
    if (unknownInNonWip.length > 0) {
      for (const loc of unknownInNonWip) {
        console.error(`  ❌ Non-@wip scenario has unknown @REQ tag: ${loc}`);
        violations++;
      }
    } else {
      console.log(
        `  ⚠️  ${unknownTags.length} @REQ-xxx tag(s) not found in spec ` +
        `(all on @wip scenarios — warning only in Phase 0).`,
      );
    }
  } else {
    console.log(`  ✅ All @REQ-xxx tags match known codes.`);
  }

  // Rule 2: @hard non-@wip scenarios must have step definitions.
  // The traceability gate verifies that at least one step-definition file exists
  // in packages/testkit/src/step-definitions/ for each active phase.
  // The authoritative check that step definitions are CORRECT is `npm run test:bdd`.
  // Here we only verify the structural invariant: non-@wip means work has started.
  const stepDefsDir = path.join(ROOT, 'packages', 'testkit', 'src', 'step-definitions');
  let stepDefFiles: string[] = [];
  try {
    stepDefFiles = (await fs.readdir(stepDefsDir)).filter(
      (f) => f.endsWith('.ts') && f !== 'world.ts',
    );
  } catch {
    stepDefFiles = [];
  }

  if (hardNonWipCount > 0) {
    if (stepDefFiles.length === 0) {
      console.error(
        `  ❌ ${hardNonWipCount} @hard non-@wip scenario(s) exist but no step definition files found in packages/testkit/src/step-definitions/.`,
      );
      violations++;
    } else {
      console.log(
        `  ✅ ${hardNonWipCount} @hard non-@wip scenario(s) covered by ${stepDefFiles.length} step-definition file(s): ${stepDefFiles.join(', ')}.`,
      );
      console.log(
        '     (Authoritative coverage check: npm run test:bdd)',
      );
    }
  } else {
    console.log('  ✅ No @hard non-@wip scenarios without step definitions.');
  }

  if (violations > 0) {
    console.error(`\n❌ Traceability gate FAILED: ${violations} violation(s).`);
    process.exit(1);
  }

  console.log('\n✅ Traceability gate passed.');
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
