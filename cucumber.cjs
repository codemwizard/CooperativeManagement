module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: [],
    import: [
      'packages/testkit/src/step-definitions/world.ts',
      'packages/testkit/src/step-definitions/kernel-steps.ts',
      'packages/testkit/src/step-definitions/auth-steps.ts',
      'packages/testkit/src/step-definitions/authz-steps.ts',
      'packages/testkit/src/step-definitions/privacy-steps.ts',
      'packages/testkit/src/step-definitions/data-mode-steps.ts',
      'packages/testkit/src/step-definitions/workspace-steps.ts',
    ],
    format: ['progress'],
    tags: 'not @wip',
  },
  wip: {
    paths: ['features/**/*.feature'],
    requireModule: [],
    import: [],
    format: ['progress'],
    tags: '@wip',
    dryRun: true,
  },
  wp61: {
    paths: ['features/10_workspace_and_capabilities.feature'],
    requireModule: [],
    import: [
      'packages/testkit/src/step-definitions/world.ts',
      'packages/testkit/src/step-definitions/workspace-live-steps.ts',
    ],
    format: ['progress'],
    tags: '(@BDD-UXW-001 or @BDD-UXW-002 or @BDD-UXW-003 or @BDD-UXW-004) and not @wip',
  },
};
