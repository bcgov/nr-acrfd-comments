module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000, // 120 seconds - needed for mongodb-memory-server download and test execution
  collectCoverageFrom: ['api/**/*.js', '!api/test/**', '!api/swagger/**'],
  coveragePathIgnorePatterns: ['/node_modules/', '/api/test/'],
}
