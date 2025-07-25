import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ValidateAddressRequest } from './types';
import { AddressValidationService } from './services/AddressValidationService';
import { SmartyAddressProvider } from './providers/SmartyAddressProvider';
import { loadConfig } from './config';
import { createErrorHandler, setupGlobalErrorHandlers } from './middleware/errorHandler';
import { InvalidRequestError, InvalidAddressError } from './errors';

// Load configuration - configuration errors will be thrown and cause startup to fail
const config = loadConfig();

// Initialize provider and service
const smartyProvider = new SmartyAddressProvider(config.smarty, config.circuitBreaker);
const validationService = new AddressValidationService(smartyProvider);

// Configure structured logging
const isDevelopment = process.env.NODE_ENV !== 'production';
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    ...(isDevelopment ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname'
        }
      }
    } : {})
  },
  genReqId: () => Math.random().toString(36).substring(2, 15),
  trustProxy: true // Enable trust proxy for rate limiting behind reverse proxies
});

// Setup global error handlers
setupGlobalErrorHandlers(fastify.log);

// Register plugins and middleware
const registerPlugins = async () => {
  // Register security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
    timeWindow: process.env.RATE_LIMIT_WINDOW || '15 minutes',
    keyGenerator: (request) => {
      // Use IP address for rate limiting
      return request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Try again in ${Math.round(context.ttl / 1000)} seconds.`,
          timestamp: new Date().toISOString(),
          requestId: request.id,
          details: {
            limit: context.max,
            window: '15 minutes',
            remaining: context.ttl
          }
        }
      };
    }
  });
};

// Add request/response logging middleware
fastify.addHook('onRequest', async (request) => {
  request.log.info({
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
    requestId: request.id
  }, 'Incoming request');
});

fastify.addHook('onResponse', async (request, reply) => {
  const responseTime = reply.elapsedTime;
  request.log.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    responseTime: `${responseTime}ms`,
    requestId: request.id
  }, 'Request completed');
});

// Register centralized error handler
fastify.setErrorHandler(createErrorHandler(fastify.log));

// Health check endpoint
fastify.get('/health', async (request) => {
  request.log.debug('Health check requested');
  return { 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };
});

// Address validation endpoint
fastify.post<{ Body: ValidateAddressRequest }>('/validate-address', async (request, reply) => {
  const startTime = Date.now();
  
  request.log.info({ requestId: request.id }, 'Starting address validation');
  
  // Basic request validation - throw errors, let centralized handler deal with them
  if (!request.body || typeof request.body !== 'object') {
    request.log.warn({ 
      requestId: request.id, 
      bodyType: typeof request.body 
    }, 'Invalid request body received');
    throw new InvalidRequestError('Request body is required', {
      bodyReceived: request.body
    }, request.id);
  }

  const { address } = request.body;

  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    request.log.warn({ 
      requestId: request.id, 
      addressType: typeof address,
      addressLength: typeof address === 'string' ? address.length : 0
    }, 'Invalid address field received');
    throw new InvalidAddressError('Address field is required and must be a non-empty string', {
      addressReceived: address,
      addressType: typeof address
    }, request.id);
  }

  // Log sanitized address (remove potential PII for logging)
  const sanitizedAddress = address.substring(0, 50) + (address.length > 50 ? '...' : '');
  request.log.info({ 
    requestId: request.id, 
    addressLength: address.length,
    sanitizedAddress 
  }, 'Processing address validation');

  // Use real address validation service - let any errors bubble up
  const result = await validationService.validateAddress(address);
  
  const processingTime = Date.now() - startTime;
  request.log.info({ 
    requestId: request.id, 
    processingTime: `${processingTime}ms`,
    validationStatus: result.status
  }, 'Address validation completed successfully');
  
  // Return successful result - no need to manually set status codes
  return result;
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    await fastify.close();
    fastify.log.info('Server closed successfully');
    process.exit(0);
  } catch (err) {
    fastify.log.error(err, 'Error during graceful shutdown');
    process.exit(1);
  }
};

// Register graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  fastify.log.fatal(error, 'Uncaught exception occurred');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.fatal({ reason, promise }, 'Unhandled promise rejection');
  gracefulShutdown('unhandledRejection');
});

const start = async () => {
  try {
    // Register all plugins first
    await registerPlugins();
    
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0'; // Changed to 0.0.0.0 for production

    fastify.log.info({
      port,
      host,
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      rateLimit: {
        max: process.env.RATE_LIMIT_MAX || '100',
        window: process.env.RATE_LIMIT_WINDOW || '15 minutes'
      }
    }, 'Starting server with configuration');

    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on http://${host}:${port}`);
    
    // Log startup success
    fastify.log.info('🚀 Address Validator API is ready to serve requests');
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    process.exit(1);
  }
};

start();