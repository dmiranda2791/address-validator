export interface ErrorContext {
  [key: string]: unknown;
}

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
  
  public readonly context: ErrorContext;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    context: ErrorContext = {},
    requestId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      requestId: this.requestId,
      stack: this.stack
    };
  }
}

// 400 - Bad Request Errors
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string, context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

export class InvalidAddressError extends AppError {
  readonly code = 'INVALID_ADDRESS';
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string = 'Address is invalid', context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

export class InvalidRequestError extends AppError {
  readonly code = 'INVALID_REQUEST';
  readonly statusCode = 400;
  readonly isOperational = true;

  constructor(message: string = 'Request is invalid', context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

// 500 - Internal Server Errors
export class InternalServerError extends AppError {
  readonly code = 'INTERNAL_SERVER_ERROR';
  readonly statusCode = 500;
  readonly isOperational = true;

  constructor(message: string = 'An internal server error occurred', context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(message: string, context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

// 503 - Service Unavailable Errors
export class ServiceUnavailableError extends AppError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(message: string = 'Service temporarily unavailable', context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

export class CircuitBreakerError extends AppError {
  readonly code = 'CIRCUIT_BREAKER_OPEN';
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(message: string = 'Address validation service is experiencing issues - please try again later', context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

// 408 - Request Timeout
export class TimeoutError extends AppError {
  readonly code = 'REQUEST_TIMEOUT';
  readonly statusCode = 408;
  readonly isOperational = true;

  constructor(message: string = 'Request timed out', context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

// 502 - Bad Gateway (for external service errors)
export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly isOperational = true;

  constructor(message: string, context: ErrorContext = {}, requestId?: string) {
    super(message, context, requestId);
  }
}

// Error type guards
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  return isAppError(error) && error.isOperational;
}