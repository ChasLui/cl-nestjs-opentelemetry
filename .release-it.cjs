module.exports = {
  git: {
    requireCleanWorkingDir: false,
    requireBranch: ['main', 'master'],
    commitMessage: 'chore: release v${version}',
    tagName: 'v${version}',
    push: true,
    pushTags: true,
  },
  github: {
    release: true,
    releaseName: 'Release ${version}',
  },
  npm: {
    publish: true,
    access: 'public',
  },
  hooks: {
    'before:init': ['pnpm test', 'pnpm build'],
    'after:bump': 'echo Successfully released ${name} v${version} to ${repo.repository}.',
  },
};
