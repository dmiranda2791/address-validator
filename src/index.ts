import Fastify from 'fastify';
import { ValidateAddressRequest, ValidateAddressResponse } from './types';

const fastify = Fastify({
  logger: true
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Address validation endpoint
fastify.post<{ Body: ValidateAddressRequest }>('/validate-address', async (request, reply) => {
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
  
  // Mock response with all required fields
  const mockResponse: ValidateAddressResponse = {
    status: 'valid',
    original: address.trim(),
    validated: {
      street: 'Main St',
      number: '123',
      city: 'Springfield',
      state: 'IL',
      zipcode: '62701'
    },
    corrections: [],
    errors: [],
    metadata: {
      provider: 'mock',
      processingTime: 50,
      retryCount: 0
    }
  };

  return mockResponse;
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