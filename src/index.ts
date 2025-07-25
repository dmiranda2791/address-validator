import 'dotenv/config';
import Fastify from 'fastify';
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

const fastify = Fastify({
  logger: true,
  genReqId: () => Math.random().toString(36).substring(2, 15)
});

// Setup global error handlers
setupGlobalErrorHandlers(fastify.log);

// Register centralized error handler
fastify.setErrorHandler(createErrorHandler(fastify.log));

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Address validation endpoint
fastify.post<{ Body: ValidateAddressRequest }>('/validate-address', async (request, reply) => {
  // Basic request validation - throw errors, let centralized handler deal with them
  if (!request.body || typeof request.body !== 'object') {
    throw new InvalidRequestError('Request body is required', {
      bodyReceived: request.body
    }, request.id);
  }

  const { address } = request.body;

  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    throw new InvalidAddressError('Address field is required and must be a non-empty string', {
      addressReceived: address,
      addressType: typeof address
    }, request.id);
  }

  // Use real address validation service - let any errors bubble up
  const result = await validationService.validateAddress(address);
  
  // Return successful result - no need to manually set status codes
  return result;
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || 'localhost';

    await fastify.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();