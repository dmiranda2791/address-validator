import { SmartyAddressProvider } from '../../providers/SmartyAddressProvider';
import { CircuitBreakerError, TimeoutError, ExternalServiceError, InvalidAddressError } from '../../errors';
import { testAddresses, mockSmartyResponses, expectedResponses } from '../fixtures/addresses';

// Mock CircuitBreaker
jest.mock('opossum');
import CircuitBreaker from 'opossum';

// Clean mock of Smarty SDK with proper typing
jest.mock('smartystreets-javascript-sdk', () => ({
  core: {
    StaticCredentials: jest.fn(),
    ClientBuilder: jest.fn()
  },
  usStreet: {
    Lookup: jest.fn()
  }
}));

// Import the actual Smarty SDK to get access to mocked module
import * as SmartyStreets from 'smartystreets-javascript-sdk';

// Get the mocked constructors with proper typing
const MockedStaticCredentials = SmartyStreets.core.StaticCredentials as jest.MockedClass<typeof SmartyStreets.core.StaticCredentials>;
const MockedClientBuilder = SmartyStreets.core.ClientBuilder as jest.MockedClass<typeof SmartyStreets.core.ClientBuilder>;
const MockedLookup = SmartyStreets.usStreet.Lookup as jest.MockedClass<typeof SmartyStreets.usStreet.Lookup>;

describe('SmartyAddressProvider', () => {
  let provider: SmartyAddressProvider;
  let mockClient: jest.Mocked<any>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker<any, any>>;
  let mockLookup: jest.Mocked<any>;
  let mockClientBuilder: jest.Mocked<any>;

  const testConfig = {
    authId: 'test-auth-id',
    authToken: 'test-auth-token',
    licenses: ['us-core-cloud'],
    maxCandidates: 1,
    matchStrategy: 'strict' as const
  };

  const circuitBreakerConfig = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Smarty SDK lookup instance
    mockLookup = {
      street: '',
      maxCandidates: undefined,
      result: undefined
    };

    // Mock Smarty SDK client instance
    mockClient = {
      send: jest.fn().mockResolvedValue(undefined)
    };

    // Mock ClientBuilder instance with chainable methods
    mockClientBuilder = {
      withLicenses: jest.fn().mockReturnThis(),
      buildUsStreetApiClient: jest.fn().mockReturnValue(mockClient)
    };

    // Mock CircuitBreaker instance
    mockCircuitBreaker = {
      fire: jest.fn(),
      on: jest.fn(),
      options: { timeout: 5000 }
    } as any;

    // Setup mocked constructors to return our mock instances
    MockedStaticCredentials.mockImplementation(() => ({}) as any);
    MockedClientBuilder.mockImplementation(() => mockClientBuilder);
    MockedLookup.mockImplementation(() => mockLookup);
    
    // Mock CircuitBreaker constructor
    (CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>).mockImplementation(
      () => mockCircuitBreaker
    );

    provider = new SmartyAddressProvider(testConfig, circuitBreakerConfig);
  });

  describe('constructor', () => {
    it('should initialize Smarty SDK client correctly', () => {
      expect(MockedStaticCredentials).toHaveBeenCalledWith(
        testConfig.authId,
        testConfig.authToken
      );
      expect(MockedClientBuilder).toHaveBeenCalled();
    });

    it('should set up circuit breaker with correct configuration', () => {
      expect(CircuitBreaker).toHaveBeenCalledWith(
        expect.any(Function),
        circuitBreakerConfig
      );
      expect(mockCircuitBreaker.on).toHaveBeenCalledTimes(3);
    });

    it('should configure licenses when provided', () => {
      expect(mockClientBuilder.withLicenses).toHaveBeenCalledWith(testConfig.licenses);
      expect(mockClientBuilder.buildUsStreetApiClient).toHaveBeenCalled();
    });
  });

  describe('validateAddress', () => {
    it('should validate a correct address successfully', async () => {
      mockCircuitBreaker.fire.mockResolvedValue(mockSmartyResponses.validAddress);

      const result = await provider.validateAddress(testAddresses.valid);

      expect(result.status).toBe('corrected'); // Address was corrected from original
      expect(result.original).toBe(testAddresses.valid);
      expect(result.validated).toBeDefined();
      expect(result.validated!.street).toBe('Amphitheatre Pkwy');
      expect(result.errors).toEqual([]);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith(testAddresses.valid);
    });

    it('should detect corrected addresses', async () => {
      mockCircuitBreaker.fire.mockResolvedValue(mockSmartyResponses.correctedAddress);

      const result = await provider.validateAddress(testAddresses.validWithTypo);

      expect(result.status).toBe('corrected');
      expect(result.original).toBe(testAddresses.validWithTypo);
      expect(result.validated).toBeDefined();
      expect(result.validated!.street).toBe('Amphitheatre Pkwy'); // Should get corrected street name
    });

    it('should handle addresses with missing secondary info (unverifiable)', async () => {
      mockCircuitBreaker.fire.mockResolvedValue(mockSmartyResponses.partialAddress);

      const result = await provider.validateAddress(testAddresses.partial);

      expect(result.status).toBe('unverifiable');
      expect(result.validated).toEqual(expectedResponses.unverifiable.validated);
    });

    it('should throw InvalidAddressError when no candidates returned', async () => {
      mockCircuitBreaker.fire.mockResolvedValue(mockSmartyResponses.invalidAddress);

      await expect(provider.validateAddress(testAddresses.invalidComplete))
        .rejects.toThrow(InvalidAddressError);

      await expect(provider.validateAddress(testAddresses.invalidComplete))
        .rejects.toThrow('Address could not be validated');
    });

    it('should throw CircuitBreakerError when circuit breaker is open', async () => {
      const circuitBreakerError = new Error('Circuit breaker is open');
      (circuitBreakerError as any).code = 'EOPENBREAKER';
      mockCircuitBreaker.fire.mockRejectedValue(circuitBreakerError);

      await expect(provider.validateAddress(testAddresses.valid))
        .rejects.toThrow(CircuitBreakerError);
    });

    it('should throw TimeoutError for timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).timeout = true;
      mockCircuitBreaker.fire.mockRejectedValue(timeoutError);

      await expect(provider.validateAddress(testAddresses.valid))
        .rejects.toThrow(TimeoutError);
    });

    it('should throw ExternalServiceError for other SDK errors', async () => {
      const sdkError = new Error('SDK connection failed');
      mockCircuitBreaker.fire.mockRejectedValue(sdkError);

      await expect(provider.validateAddress(testAddresses.valid))
        .rejects.toThrow(ExternalServiceError);
    });
  });

  describe('private methods integration', () => {
    it('should map Smarty response to ValidatedAddress correctly', async () => {
      mockCircuitBreaker.fire.mockResolvedValue(mockSmartyResponses.validAddress);

      const result = await provider.validateAddress(testAddresses.valid);

      expect(result.validated).toEqual({
        street: 'Amphitheatre Pkwy',
        number: '1600',
        city: 'Mountain View',
        state: 'CA',
        zipcode: '94043-1351'
      });
    });

    it('should determine validation status based on dpv_match_code', async () => {
      // Test different dpv_match_codes
      const testCases = [
        { dpvMatchCode: 'Y', expectedStatus: 'corrected' }, // Will be corrected if address differs
        { dpvMatchCode: 'S', expectedStatus: 'corrected' },
        { dpvMatchCode: 'D', expectedStatus: 'unverifiable' },
        { dpvMatchCode: 'N', expectedStatus: 'invalid' },
        { dpvMatchCode: '', expectedStatus: 'invalid' }
      ];

      for (const testCase of testCases) {
        const mockResponse = [{
          ...mockSmartyResponses.validAddress[0],
          analysis: {
            ...mockSmartyResponses.validAddress[0].analysis,
            dpvMatchCode: testCase.dpvMatchCode as any
          }
        }];

        mockCircuitBreaker.fire.mockResolvedValue(mockResponse);

        const result = await provider.validateAddress(testAddresses.valid);
        expect(result.status).toBe(testCase.expectedStatus);
      }
    });

    it('should detect address corrections by comparing normalized addresses', async () => {
      // Create a response where the standardized address differs from input
      const correctedResponse = [{
        ...mockSmartyResponses.validAddress[0],
        deliveryLine1: '1600 Amphitheatre Pkwy', // Corrected spelling
        lastLine: 'Mountain View CA 94043-1351'
      }];

      mockCircuitBreaker.fire.mockResolvedValue(correctedResponse);

      // Use input with typo
      const result = await provider.validateAddress('1600 Ampitheater Parkway, Mountain View, CA');

      expect(result.status).toBe('corrected');
    });
  });

  describe('error context', () => {
    it('should include proper context in InvalidAddressError', async () => {
      mockCircuitBreaker.fire.mockResolvedValue([]);

      try {
        await provider.validateAddress(testAddresses.invalidComplete);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAddressError);
        expect((error as InvalidAddressError).context).toEqual({
          originalAddress: testAddresses.invalidComplete,
          provider: 'smarty',
          reason: 'no_candidates_returned'
        });
      }
    });

    it('should include proper context in CircuitBreakerError', async () => {
      const circuitBreakerError = new Error('Circuit breaker is open');
      (circuitBreakerError as any).code = 'EOPENBREAKER';
      mockCircuitBreaker.fire.mockRejectedValue(circuitBreakerError);

      try {
        await provider.validateAddress(testAddresses.valid);
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        expect((error as CircuitBreakerError).context).toEqual({
          originalAddress: testAddresses.valid,
          provider: 'smarty',
          circuitBreakerState: 'open'
        });
      }
    });
  });
});