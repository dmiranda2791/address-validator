// Test setup file
import 'dotenv/config';

// Mock environment variables for testing
process.env.SMARTY_AUTH_ID = 'test-auth-id';
process.env.SMARTY_AUTH_TOKEN = 'test-auth-token';
process.env.SMARTY_LICENSES = 'us-core-cloud';
process.env.SMARTY_MAX_CANDIDATES = '1';
process.env.CIRCUIT_BREAKER_TIMEOUT = '5000';
process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD = '50';
process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '10000';

// Mock console methods to avoid noise in test output
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});