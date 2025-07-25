import { AddressValidationService } from '../../services/AddressValidationService';
import { ValidationProviderAdapter, AddressValidationResponse } from '../../types';
import { InvalidAddressError } from '../../errors';
import { testAddresses, expectedResponses } from '../fixtures/addresses';

describe('AddressValidationService', () => {
  let service: AddressValidationService;
  let mockProvider: jest.Mocked<ValidationProviderAdapter>;

  beforeEach(() => {
    mockProvider = {
      validateAddress: jest.fn()
    };
    service = new AddressValidationService(mockProvider);
  });

  describe('validateAddress', () => {
    it('should delegate validation to the provider for valid input', async () => {
      const mockResponse: AddressValidationResponse = expectedResponses.valid;
      mockProvider.validateAddress.mockResolvedValue(mockResponse);

      const result = await service.validateAddress(testAddresses.valid);

      expect(mockProvider.validateAddress).toHaveBeenCalledWith(testAddresses.valid);
      expect(result).toEqual(mockResponse);
    });

    it('should trim whitespace from address input', async () => {
      const addressWithWhitespace = '  ' + testAddresses.valid + '  ';
      const mockResponse: AddressValidationResponse = expectedResponses.valid;
      mockProvider.validateAddress.mockResolvedValue(mockResponse);

      await service.validateAddress(addressWithWhitespace);

      expect(mockProvider.validateAddress).toHaveBeenCalledWith(testAddresses.valid);
    });

    it('should throw InvalidAddressError for empty string', async () => {
      await expect(service.validateAddress(testAddresses.empty))
        .rejects.toThrow(InvalidAddressError);

      await expect(service.validateAddress(testAddresses.empty))
        .rejects.toThrow('Address is required and must be a non-empty string');

      expect(mockProvider.validateAddress).not.toHaveBeenCalled();
    });

    it('should throw InvalidAddressError for whitespace-only string', async () => {
      await expect(service.validateAddress(testAddresses.whitespace))
        .rejects.toThrow(InvalidAddressError);

      expect(mockProvider.validateAddress).not.toHaveBeenCalled();
    });

    it('should throw InvalidAddressError for null input', async () => {
      await expect(service.validateAddress(null as any))
        .rejects.toThrow(InvalidAddressError);

      expect(mockProvider.validateAddress).not.toHaveBeenCalled();
    });

    it('should throw InvalidAddressError for undefined input', async () => {
      await expect(service.validateAddress(undefined as any))
        .rejects.toThrow(InvalidAddressError);

      expect(mockProvider.validateAddress).not.toHaveBeenCalled();
    });

    it('should throw InvalidAddressError for non-string input', async () => {
      await expect(service.validateAddress(123 as any))
        .rejects.toThrow(InvalidAddressError);

      await expect(service.validateAddress({} as any))
        .rejects.toThrow(InvalidAddressError);

      await expect(service.validateAddress([] as any))
        .rejects.toThrow(InvalidAddressError);

      expect(mockProvider.validateAddress).not.toHaveBeenCalled();
    });

    it('should let provider errors bubble up', async () => {
      const providerError = new Error('Provider specific error');
      mockProvider.validateAddress.mockRejectedValue(providerError);

      await expect(service.validateAddress(testAddresses.valid))
        .rejects.toThrow(providerError);

      expect(mockProvider.validateAddress).toHaveBeenCalledWith(testAddresses.valid);
    });

    it('should handle various validation response statuses', async () => {
      const testCases = [
        { response: expectedResponses.valid, status: 'valid' },
        { response: expectedResponses.corrected, status: 'corrected' },
        { response: expectedResponses.unverifiable, status: 'unverifiable' }
      ];

      for (const testCase of testCases) {
        mockProvider.validateAddress.mockResolvedValue(testCase.response);

        const result = await service.validateAddress(testAddresses.valid);

        expect(result.status).toBe(testCase.status);
        expect(result).toEqual(testCase.response);
      }
    });
  });

  describe('error context', () => {
    it('should include proper context in InvalidAddressError for empty input', async () => {
      try {
        await service.validateAddress('');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAddressError);
        expect((error as InvalidAddressError).context).toEqual({
          originalAddress: '',
          validationType: 'input'
        });
      }
    });

    it('should include proper context in InvalidAddressError for null input', async () => {
      try {
        await service.validateAddress(null as any);
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAddressError);
        expect((error as InvalidAddressError).context).toEqual({
          originalAddress: null,
          validationType: 'input'
        });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long addresses', async () => {
      const longAddress = 'A'.repeat(1000) + ' Street, City, State 12345';
      const mockResponse: AddressValidationResponse = {
        status: 'invalid',
        original: longAddress,
        validated: undefined,
        errors: []
      };
      mockProvider.validateAddress.mockResolvedValue(mockResponse);

      const result = await service.validateAddress(longAddress);

      expect(mockProvider.validateAddress).toHaveBeenCalledWith(longAddress);
      expect(result).toEqual(mockResponse);
    });

    it('should handle addresses with special characters', async () => {
      const specialAddress = '123 Main St #Apt-B, O\'Fallon, MO 63366';
      const mockResponse: AddressValidationResponse = expectedResponses.valid;
      mockProvider.validateAddress.mockResolvedValue(mockResponse);

      const result = await service.validateAddress(specialAddress);

      expect(mockProvider.validateAddress).toHaveBeenCalledWith(specialAddress);
      expect(result).toEqual(mockResponse);
    });

    it('should handle unicode characters in addresses', async () => {
      const unicodeAddress = '123 Café Street, São Paulo, CA 90210';
      const mockResponse: AddressValidationResponse = expectedResponses.valid;
      mockProvider.validateAddress.mockResolvedValue(mockResponse);

      const result = await service.validateAddress(unicodeAddress);

      expect(mockProvider.validateAddress).toHaveBeenCalledWith(unicodeAddress);
      expect(result).toEqual(mockResponse);
    });
  });
});