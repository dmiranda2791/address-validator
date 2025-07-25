import {
  AppError,
  ValidationError,
  InvalidAddressError,
  InvalidRequestError,
  InternalServerError,
  ConfigurationError,
  ServiceUnavailableError,
  CircuitBreakerError,
  TimeoutError,
  ExternalServiceError,
  isAppError,
  isOperationalError
} from '../../errors';

describe('Error Classes', () => {
  const testMessage = 'Test error message';
  const testContext = { key: 'value', number: 42 };
  const testRequestId = 'test-request-id-123';

  describe('ValidationError', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError(testMessage, testContext, testRequestId);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.message).toBe(testMessage);
      expect(error.context).toEqual(testContext);
      expect(error.requestId).toBe(testRequestId);
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should work with minimal parameters', () => {
      const error = new ValidationError(testMessage);

      expect(error.message).toBe(testMessage);
      expect(error.context).toEqual({});
      expect(error.requestId).toBeUndefined();
    });
  });

  describe('InvalidAddressError', () => {
    it('should create InvalidAddressError with correct properties', () => {
      const error = new InvalidAddressError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('INVALID_ADDRESS');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const error = new InvalidAddressError();

      expect(error.message).toBe('Address is invalid');
    });
  });

  describe('InvalidRequestError', () => {
    it('should create InvalidRequestError with correct properties', () => {
      const error = new InvalidRequestError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('INVALID_REQUEST');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const error = new InvalidRequestError();

      expect(error.message).toBe('Request is invalid');
    });
  });

  describe('InternalServerError', () => {
    it('should create InternalServerError with correct properties', () => {
      const error = new InternalServerError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const error = new InternalServerError();

      expect(error.message).toBe('An internal server error occurred');
    });
  });

  describe('ConfigurationError', () => {
    it('should create ConfigurationError with correct properties', () => {
      const error = new ConfigurationError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false); // Non-operational error
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create ServiceUnavailableError with correct properties', () => {
      const error = new ServiceUnavailableError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const error = new ServiceUnavailableError();

      expect(error.message).toBe('Service temporarily unavailable');
    });
  });

  describe('CircuitBreakerError', () => {
    it('should create CircuitBreakerError with correct properties', () => {
      const error = new CircuitBreakerError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const error = new CircuitBreakerError();

      expect(error.message).toBe('Address validation service is experiencing issues - please try again later');
    });
  });

  describe('TimeoutError', () => {
    it('should create TimeoutError with correct properties', () => {
      const error = new TimeoutError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('REQUEST_TIMEOUT');
      expect(error.statusCode).toBe(408);
      expect(error.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const error = new TimeoutError();

      expect(error.message).toBe('Request timed out');
    });
  });

  describe('ExternalServiceError', () => {
    it('should create ExternalServiceError with correct properties', () => {
      const error = new ExternalServiceError(testMessage, testContext, testRequestId);

      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('AppError base class', () => {
    class TestError extends AppError {
      readonly code = 'TEST_ERROR';
      readonly statusCode = 418; // I'm a teapot
      readonly isOperational = true;
    }

    it('should capture stack trace', () => {
      const error = new TestError(testMessage);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TestError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new TestError(testMessage, testContext, testRequestId);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'TestError',
        code: 'TEST_ERROR',
        message: testMessage,
        statusCode: 418,
        context: testContext,
        timestamp: error.timestamp,
        requestId: testRequestId,
        stack: error.stack
      });
    });

    it('should handle empty context correctly', () => {
      const error = new TestError(testMessage);
      const json = error.toJSON();

      expect(json.context).toEqual({});
      expect(json.requestId).toBeUndefined();
    });
  });

  describe('Type guards', () => {
    describe('isAppError', () => {
      it('should return true for AppError instances', () => {
        const validationError = new ValidationError(testMessage);
        const timeoutError = new TimeoutError(testMessage);

        expect(isAppError(validationError)).toBe(true);
        expect(isAppError(timeoutError)).toBe(true);
      });

      it('should return false for regular Error instances', () => {
        const regularError = new Error(testMessage);
        const typeError = new TypeError(testMessage);

        expect(isAppError(regularError)).toBe(false);
        expect(isAppError(typeError)).toBe(false);
      });

      it('should return false for non-Error values', () => {
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
        expect(isAppError('error')).toBe(false);
        expect(isAppError(42)).toBe(false);
        expect(isAppError({})).toBe(false);
      });
    });

    describe('isOperationalError', () => {
      it('should return true for operational AppError instances', () => {
        const validationError = new ValidationError(testMessage);
        const timeoutError = new TimeoutError(testMessage);

        expect(isOperationalError(validationError)).toBe(true);
        expect(isOperationalError(timeoutError)).toBe(true);
      });

      it('should return false for non-operational AppError instances', () => {
        const configError = new ConfigurationError(testMessage);

        expect(isOperationalError(configError)).toBe(false);
      });

      it('should return false for non-AppError instances', () => {
        const regularError = new Error(testMessage);

        expect(isOperationalError(regularError)).toBe(false);
        expect(isOperationalError(null)).toBe(false);
        expect(isOperationalError('error')).toBe(false);
      });
    });
  });

  describe('Error inheritance', () => {
    it('should properly inherit from Error', () => {
      const error = new ValidationError(testMessage);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should have correct prototype chain', () => {
      const error = new CircuitBreakerError(testMessage);

      expect(Object.getPrototypeOf(error)).toBe(CircuitBreakerError.prototype);
      expect(Object.getPrototypeOf(CircuitBreakerError.prototype)).toBe(AppError.prototype);
      expect(Object.getPrototypeOf(AppError.prototype)).toBe(Error.prototype);
    });
  });

  describe('Error context handling', () => {
    it('should handle complex context objects', () => {
      const complexContext = {
        address: '123 Main St',
        provider: 'smarty',
        metadata: {
          attempts: 3,
          lastAttempt: new Date().toISOString()
        },
        errors: ['connection failed', 'timeout'],
        config: {
          timeout: 5000,
          retries: 3
        }
      };

      const error = new ExternalServiceError(testMessage, complexContext, testRequestId);

      expect(error.context).toEqual(complexContext);
      expect(error.toJSON().context).toEqual(complexContext);
    });

    it('should handle undefined and null values in context', () => {
      const contextWithNulls = {
        value: null,
        undefined: undefined,
        zero: 0,
        empty: '',
        false: false
      };

      const error = new ValidationError(testMessage, contextWithNulls);

      expect(error.context).toEqual(contextWithNulls);
    });
  });
});