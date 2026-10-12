export default {
  cacheDir: process.env.LIFECYCLE_RUNTIME_SCRATCH,
  test: { globals: true, include: ["*.test.js"], cache: false },
};
