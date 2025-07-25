import Fastify, { FastifyInstance } from 'fastify';
import { jest } from '@jest/globals';

// Mock external dependencies before importing our modules
jest.mock('smartystreets-javascript-sdk');
jest.mock('opossum');

import { createErrorHandler, setupGlobalErrorHandlers } from '../../middleware/errorHandler';
import { AddressValidationService } from '../../services/AddressValidationService';
import { SmartyAddressProvider } from '../../providers/SmartyAddressProvider';
import { loadConfig } from '../../config';
import { InvalidRequestError, InvalidAddressError } from '../../errors';
import { ValidateAddressRequest } from '../../types';
import { testAddresses, expectedResponses } from '../fixtures/addresses';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let mockProvider: jest.Mocked<SmartyAddressProvider>;
  let validationService: AddressValidationService;

  beforeAll(async () => {
    // Setup Fastify app similar to main app
    app = Fastify({
      logger: false, // Disable logging in tests
      genReqId: () => 'test-request-id'
    });

    // Setup error handlers
    setupGlobalErrorHandlers(app.log);
    app.setErrorHandler(createErrorHandler(app.log));

    // Mock the provider
    mockProvider = {
      validateAddress: jest.fn()
    } as any;

    validationService = new AddressValidationService(mockProvider);

    // Health check endpoint
    app.get('/health', async () => {
      return { status: 'ok' };
    });

    // Address validation endpoint (same logic as main app)
    app.post<{ Body: ValidateAddressRequest }>('/validate-address', async (request, reply) => {
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

      const result = await validationService.validateAddress(address);
      return result;
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
    });
  });

  describe('POST /validate-address', () => {
    describe('Success cases', () => {
      it('should validate a correct address', async () => {
        mockProvider.validateAddress.mockResolvedValue(expectedResponses.valid);

        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: testAddresses.valid
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual(expectedResponses.valid);
        expect(mockProvider.validateAddress).toHaveBeenCalledWith(testAddresses.valid);
      });

      it('should handle corrected addresses', async () => {
        mockProvider.validateAddress.mockResolvedValue(expectedResponses.corrected);

        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: testAddresses.validWithTypo
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual(expectedResponses.corrected);
      });

      it('should handle unverifiable addresses', async () => {
        mockProvider.validateAddress.mockResolvedValue(expectedResponses.unverifiable);

        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: testAddresses.partial
          }
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual(expectedResponses.unverifiable);
      });
    });

    describe('Request validation errors', () => {
      it('should return 400 for missing request body', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          }
          // No payload
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        // Fastify returns its own error for empty JSON body
        expect(body.error.code).toBe('FST_ERR_CTP_EMPTY_JSON_BODY');
        expect(body.error.message).toContain('Body cannot be empty');
        expect(mockProvider.validateAddress).not.toHaveBeenCalled();
      });

      it('should return 400 for invalid JSON body', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: 'invalid json'
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        // Fastify returns CLIENT_ERROR for JSON parse failures
        expect(body.error.code).toBe('CLIENT_ERROR');
      });

      it('should return 400 for missing address field', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {}
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error.code).toBe('INVALID_ADDRESS');
        expect(body.error.message).toBe('Address field is required and must be a non-empty string');
        expect(body.error.details.addressType).toBe('undefined');
      });

      it('should return 400 for empty address', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: ''
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error.code).toBe('INVALID_ADDRESS');
        expect(body.error.details.addressReceived).toBe('');
        expect(body.error.details.addressType).toBe('string');
      });

      it('should return 400 for non-string address', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: 123
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error.code).toBe('INVALID_ADDRESS');
        expect(body.error.details.addressReceived).toBe(123);
        expect(body.error.details.addressType).toBe('number');
      });

      it('should return 400 for whitespace-only address', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: '   '
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error.code).toBe('INVALID_ADDRESS');
      });
    });

    describe('Provider error handling', () => {
      it('should handle InvalidAddressError from provider', async () => {
        const providerError = new InvalidAddressError('Address could not be validated', {
          originalAddress: testAddresses.invalidComplete,
          provider: 'smarty',
          reason: 'no_candidates_returned'
        });

        mockProvider.validateAddress.mockRejectedValue(providerError);

        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: testAddresses.invalidComplete
          }
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error.code).toBe('INVALID_ADDRESS');
        expect(body.error.message).toBe('Address could not be validated');
        expect(body.error.details.originalAddress).toBe(testAddresses.invalidComplete);
      });

      it('should handle unexpected provider errors as 500', async () => {
        const unexpectedError = new Error('Unexpected error');
        mockProvider.validateAddress.mockRejectedValue(unexpectedError);

        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: testAddresses.valid
          }
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.payload);
        expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(body.error.message).toBe('An unexpected error occurred');
      });
    });

    describe('Error response structure', () => {
      it('should include all required error fields', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {
            address: ''
          }
        });

        const body = JSON.parse(response.payload);
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(body.error).toHaveProperty('timestamp');
        expect(body.error).toHaveProperty('requestId');
        expect(body.error).toHaveProperty('details');
        
        expect(typeof body.error.code).toBe('string');
        expect(typeof body.error.message).toBe('string');
        expect(typeof body.error.timestamp).toBe('string');
        expect(typeof body.error.requestId).toBe('string');
        expect(typeof body.error.details).toBe('object');
      });

      it('should have consistent timestamp format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'application/json'
          },
          payload: {}
        });

        const body = JSON.parse(response.payload);
        expect(body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    describe('Content-Type handling', () => {
      it('should reject non-JSON content type', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          headers: {
            'content-type': 'text/plain'
          },
          payload: 'some text'
        });

        expect(response.statusCode).toBe(400);
      });

      it('should handle missing content-type header', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/validate-address',
          payload: JSON.stringify({ address: testAddresses.valid })
        });

        // Fastify might return 415 without content-type, which is acceptable behavior
        expect([200, 400, 415]).toContain(response.statusCode);
      });
    });
  });

  describe('HTTP method handling', () => {
    it('should return 404 for GET on /validate-address', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/validate-address'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for PUT on /validate-address', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/validate-address'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for non-existent endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent'
      });

      expect(response.statusCode).toBe(404);
    });
  });
});