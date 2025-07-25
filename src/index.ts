import 'dotenv/config';
import Fastify from 'fastify';
import { ValidateAddressRequest } from './types';
import { AddressValidationService } from './services/AddressValidationService';
import { SmartyAddressProvider } from './providers/SmartyAddressProvider';
import { loadConfig } from './config';

// Load configuration
const config = loadConfig();

// Initialize provider and service
const smartyProvider = new SmartyAddressProvider(config.smarty, config.circuitBreaker);
const validationService = new AddressValidationService(smartyProvider);

const fastify = Fastify({
  logger: true
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Address validation endpoint
fastify.post<{ Body: ValidateAddressRequest }>('/validate-address', async (request, reply) => {
  try {
    // Basic request validation
    if (!request.body || typeof request.body !== 'object') {
      reply.status(400);
      return {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required',
          timestamp: new Date().toISOString(),
          requestId: request.id
        }
      };
    }

    const { address } = request.body;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      reply.status(400);
      return {
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Address field is required and must be a non-empty string',
          timestamp: new Date().toISOString(),
          requestId: request.id
        }
      };
    }

    // Use real address validation service
    const result = await validationService.validateAddress(address);
    
    // Set appropriate HTTP status based on validation result
    if (result.status === 'invalid' && result.errors && result.errors.length > 0) {
      reply.status(400);
    } else {
      reply.status(200);
    }

    return result;

  } catch (error) {
    // Handle unexpected errors
    reply.status(500);
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error occurred during address validation',
        timestamp: new Date().toISOString(),
        requestId: request.id
      }
    };
  }
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