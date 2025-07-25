interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  smarty: {
    authId: string;
    authToken: string;
    licenses: string[];
    maxCandidates: number;
    matchStrategy: 'strict' | 'invalid' | 'enhanced';
  };
  circuitBreaker: {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
  };
  logging: {
    level: string;
    format: string;
  };
}

function validateRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function getEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number, got: ${value}`);
  }
  return parsed;
}

function getEnvVarAsArray(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

export function loadConfig(): AppConfig {
  try {
    return {
      server: {
        port: getEnvVarAsNumber('PORT', 3000),
        host: getEnvVar('HOST', 'localhost'),
      },
      smarty: {
        authId: validateRequiredEnvVar('SMARTY_AUTH_ID'),
        authToken: validateRequiredEnvVar('SMARTY_AUTH_TOKEN'),
        licenses: getEnvVarAsArray('SMARTY_LICENSES', ['us-core-cloud']),
        maxCandidates: getEnvVarAsNumber('SMARTY_MAX_CANDIDATES', 1),
        matchStrategy: (getEnvVar('SMARTY_MATCH_STRATEGY', 'strict') as 'strict' | 'invalid' | 'enhanced'),
      },
      circuitBreaker: {
        timeout: getEnvVarAsNumber('CIRCUIT_BREAKER_TIMEOUT', 10000),
        errorThresholdPercentage: getEnvVarAsNumber('CIRCUIT_BREAKER_ERROR_THRESHOLD', 50),
        resetTimeout: getEnvVarAsNumber('CIRCUIT_BREAKER_RESET_TIMEOUT', 30000),
      },
      logging: {
        level: getEnvVar('LOG_LEVEL', 'info'),
        format: getEnvVar('LOG_FORMAT', 'json'),
      },
    };
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
}

export type { AppConfig };