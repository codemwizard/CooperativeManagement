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
};
