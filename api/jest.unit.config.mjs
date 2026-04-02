/** @type {import('jest').Config} */
const config = {
    clearMocks: true,
    collectCoverage: true,
    collectCoverageFrom: [
        'helpers/**/*.js',
        'middleware/**/*.js',
        'model/**/*.js',
        'routes/**/*.js',
    ],
    coverageDirectory: 'tests/coverage',
    coverageProvider: 'v8',
    coverageReporters: ['text', 'lcov', 'html'],
    roots: ['<rootDir>/tests/unit'],
    setupFiles: ['<rootDir>/tests/unit/setup-env.js'],
    testEnvironment: 'node',
    testMatch: ['**/*.test.js'],
};

export default config;