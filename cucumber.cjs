module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: [],
    require: [],
    format: ['progress'],
    tags: 'not @wip',
  },
  wip: {
    paths: ['features/**/*.feature'],
    requireModule: [],
    require: [],
    format: ['progress'],
    tags: '@wip',
    dryRun: true,
  },
};

