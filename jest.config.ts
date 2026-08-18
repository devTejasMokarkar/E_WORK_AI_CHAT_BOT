import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverage: false,
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {}],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid)/)',
  ],
};

export default createJestConfig(config);