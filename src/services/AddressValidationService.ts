import { ValidationProviderAdapter, AddressValidationResponse } from '../types';
import { InvalidAddressError } from '../errors';

export class AddressValidationService {
  private provider: ValidationProviderAdapter;

  constructor(provider: ValidationProviderAdapter) {
    this.provider = provider;
  }

  async validateAddress(address: string): Promise<AddressValidationResponse> {
    // Validate input
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      throw new InvalidAddressError('Address is required and must be a non-empty string', {
        originalAddress: address,
        validationType: 'input'
      });
    }

    // Delegate to the provider - let any errors bubble up
    return await this.provider.validateAddress(address.trim());
  }
}