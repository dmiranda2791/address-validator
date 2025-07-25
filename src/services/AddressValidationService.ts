import { ValidationProviderAdapter, AddressValidationResponse } from '../types';

export class AddressValidationService {
  private provider: ValidationProviderAdapter;

  constructor(provider: ValidationProviderAdapter) {
    this.provider = provider;
  }

  async validateAddress(address: string): Promise<AddressValidationResponse> {
    // Validate input
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return {
        status: 'invalid',
        original: address,
        errors: ['Address is required and must be a non-empty string']
      };
    }

    try {
      // Delegate to the provider
      const result = await this.provider.validateAddress(address.trim());
      return result;
    } catch (error) {
      // Handle any unexpected errors
      return {
        status: 'invalid',
        original: address,
        errors: ['Address validation failed due to an internal error']
      };
    }
  }
}