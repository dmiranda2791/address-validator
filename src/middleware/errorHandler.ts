import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, isAppError, isOperationalError } from '../errors';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
    details?: unknown;
  };
}

export function createErrorHandler(logger: any) {
  return async function errorHandler(
    error: FastifyError | AppError | Error,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const requestId = request.id;

    // Handle our custom AppError instances
    if (isAppError(error)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          timestamp: error.timestamp,
          requestId: requestId,
          details: error.context
        }
      };

      // Log operational errors as warnings, non-operational as errors
      if (isOperationalError(error)) {
        logger.warn(
          {
            err: error,
            req: request,
            requestId,
            errorCode: error.code,
            context: error.context
          },
          `Operational error: ${error.message}`
        );
      } else {
        logger.error(
          {
            err: error,
            req: request,
            requestId,
            errorCode: error.code,
            context: error.context
          },
          `Non-operational error: ${error.message}`
        );
      }

      reply.status(error.statusCode).send(errorResponse);
      return;
    }

    // Handle Fastify validation errors
    if ('statusCode' in error && error.statusCode === 400 && 'validation' in error && error.validation) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          timestamp: new Date().toISOString(),
          requestId: requestId,
          details: 'validation' in error ? error.validation : undefined
        }
      };

      logger.warn(
        {
          err: error,
          req: request,
          requestId,
          validation: 'validation' in error ? error.validation : undefined
        },
        'Request validation failed'
      );

      reply.status(400).send(errorResponse);
      return;
    }

    // Handle other Fastify errors (like 404, etc.)
    if ('statusCode' in error && error.statusCode && error.statusCode < 500) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ('code' in error && error.code) ? error.code : 'CLIENT_ERROR',
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: requestId
        }
      };

      logger.warn(
        {
          err: error,
          req: request,
          requestId,
          statusCode: error.statusCode
        },
        `Client error: ${error.message}`
      );

      reply.status(error.statusCode).send(errorResponse);
      return;
    }

    // Handle unexpected errors (programming errors, etc.)
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId: requestId
      }
    };

    logger.error(
      {
        err: error,
        req: request,
        requestId,
        stack: error.stack
      },
      `Unexpected error: ${error.message}`
    );

    reply.status(500).send(errorResponse);
  };
}

// Global uncaught exception handler
export function setupGlobalErrorHandlers(logger: any): void {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal(
      {
        err: error,
        stack: error.stack
      },
      'Uncaught exception occurred'
    );
    
    // Give the logger time to write before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.fatal(
      {
        reason,
        promise
      },
      'Unhandled promise rejection occurred'
    );
    
    // Don't exit for unhandled rejections, just log them
    // In production, you might want to exit depending on your needs
  });
}