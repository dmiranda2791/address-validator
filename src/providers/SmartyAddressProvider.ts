import CircuitBreaker from 'opossum';
import * as SmartyStreets from 'smartystreets-javascript-sdk';
import {
  ValidationProviderAdapter,
  AddressValidationResponse,
  ValidatedAddress,
  ValidationStatus
} from '../types';
import { 
  CircuitBreakerError, 
  TimeoutError, 
  ExternalServiceError,
  InvalidAddressError 
} from '../errors';

interface SmartyConfig {
  authId: string;
  authToken: string;
  licenses?: string[];
  maxCandidates?: number;
  matchStrategy?: 'strict' | 'invalid' | 'enhanced';
}

interface CircuitBreakerConfig {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
}

export class SmartyAddressProvider implements ValidationProviderAdapter {
  private smartyClient: SmartyStreets.core.Client<SmartyStreets.usStreet.Lookup | SmartyStreets.core.Batch<SmartyStreets.usStreet.Lookup>, SmartyStreets.core.Batch<SmartyStreets.usStreet.Lookup>>;
  private circuitBreaker: CircuitBreaker<[string], SmartyStreets.usStreet.Candidate[]>;
  private config: SmartyConfig;

  constructor(config: SmartyConfig, circuitBreakerConfig: CircuitBreakerConfig) {
    this.config = config;

    // Initialize Smarty SDK client
    const credentials = new SmartyStreets.core.StaticCredentials(config.authId, config.authToken);
    const clientBuilder = new SmartyStreets.core.ClientBuilder(credentials);

    if (config.licenses && config.licenses.length > 0) {
      clientBuilder.withLicenses(config.licenses);
    }

    this.smartyClient = clientBuilder.buildUsStreetApiClient();

    // Initialize Opossum circuit breaker wrapping Smarty API calls
    this.circuitBreaker = new CircuitBreaker<[string], SmartyStreets.usStreet.Candidate[]>(this.callSmartyAPI.bind(this), {
      timeout: circuitBreakerConfig.timeout,
      errorThresholdPercentage: circuitBreakerConfig.errorThresholdPercentage,
      resetTimeout: circuitBreakerConfig.resetTimeout,
    });

    // Setup circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      console.warn('Smarty API circuit breaker opened - failing fast');
    });

    this.circuitBreaker.on('halfOpen', () => {
      console.info('Smarty API circuit breaker half-open - attempting recovery');
    });

    this.circuitBreaker.on('close', () => {
      console.info('Smarty API circuit breaker closed - normal operation resumed');
    });
  }

  async validateAddress(address: string): Promise<AddressValidationResponse> {
    try {
      // Call Smarty SDK through circuit breaker
      const smartyResponse = await this.circuitBreaker.fire(address);

      // Handle empty array responses (invalid addresses)
      if (!smartyResponse || smartyResponse.length === 0) {
        throw new InvalidAddressError('Address could not be validated', {
          originalAddress: address,
          provider: 'smarty',
          reason: 'no_candidates_returned'
        });
      }

      // Use the first candidate (most likely match)
      const candidate = smartyResponse[0];

      // Map Smarty response to internal format
      const validatedAddress = this.mapToValidatedAddress(candidate);

      // Determine validation status using analysis data
      const status = this.determineValidationStatus(candidate, address);

      // Create the response
      const response: AddressValidationResponse = {
        status,
        original: address,
        validated: validatedAddress,
        errors: []
      };

      return response;

    } catch (error) {
      // Transform external errors to domain errors
      this.handleAndThrowError(error as Error, address);
    }
  }

  private async callSmartyAPI(address: string): Promise<SmartyStreets.usStreet.Candidate[]> {
    const lookup = new SmartyStreets.usStreet.Lookup();
    lookup.street = address;

    if (this.config.maxCandidates) {
      lookup.maxCandidates = this.config.maxCandidates;
    }

    await this.smartyClient.send(lookup);
    return lookup.result || [];
  }

  private handleAndThrowError(error: Error, address: string): never {
    // Check if it's already one of our domain errors and re-throw
    if (error instanceof InvalidAddressError || 
        error instanceof CircuitBreakerError || 
        error instanceof TimeoutError || 
        error instanceof ExternalServiceError) {
      throw error;
    }

    // Transform circuit breaker errors
    if ((error as NodeJS.ErrnoException).code === 'EOPENBREAKER') {
      throw new CircuitBreakerError('Address validation service is experiencing issues - please try again later', {
        originalAddress: address,
        provider: 'smarty',
        circuitBreakerState: 'open'
      });
    }

    // Transform timeout errors
    if ('timeout' in error || error.message.includes('timeout')) {
      throw new TimeoutError('Address validation request timed out', {
        originalAddress: address,
        provider: 'smarty'
      });
    }

    // Transform other external service errors
    throw new ExternalServiceError(`Smarty API error: ${error.message}`, {
      originalAddress: address,
      provider: 'smarty',
      originalError: error.message,
      stack: error.stack
    });
  }

  private determineValidationStatus(
    candidate: SmartyStreets.usStreet.Candidate,
    originalInput: string
  ): ValidationStatus {
    const analysis = candidate.analysis;

    // Empty array response handled in main method
    if (!analysis) {
      return 'invalid';
    }

    const dpvMatchCode = analysis.dpvMatchCode;

    // Determine base status from dpv_match_code
    let baseStatus: ValidationStatus;
    switch (dpvMatchCode) {
      case 'Y':
        baseStatus = 'valid';
        break;
      case 'S':
        baseStatus = 'corrected'; // Secondary info ignored
        break;
      case 'D':
        baseStatus = 'unverifiable'; // Missing secondary info
        break;
      case 'N':
      case '':
      default:
        baseStatus = 'invalid';
        break;
    }

    // If base status is 'valid', check if any corrections were made
    if (baseStatus === 'valid') {
      const hasCorrections = this.hasAddressCorrections(originalInput, candidate);
      if (hasCorrections) {
        return 'corrected';
      }
    }

    return baseStatus;
  }

  private mapToValidatedAddress(candidate: SmartyStreets.usStreet.Candidate): ValidatedAddress {
    const components = candidate.components;

    return {
      street: this.buildStreetName(components),
      number: components.primaryNumber || '',
      city: components.cityName || '',
      state: components.state || '',
      zipcode: components.zipCode + (components.plus4Code ? `-${components.plus4Code}` : '')
    };
  }

  private buildStreetName(components: SmartyStreets.usStreet.Component): string {
    const parts = [
      components.streetPredirection,
      components.streetName,
      components.streetSuffix,
      components.streetPostdirection
    ].filter(Boolean);

    return parts.join(' ');
  }


  private hasAddressCorrections(originalInput: string, candidate: SmartyStreets.usStreet.Candidate): boolean {
    // Create a full standardized address from Smarty response
    const standardizedFull = candidate.deliveryLine1 +
      (candidate.deliveryLine2 ? ` ${candidate.deliveryLine2}` : '') +
      `, ${candidate.lastLine}`;

    // Normalize both addresses for comparison
    const normalizedOriginal = this.normalizeAddressForComparison(originalInput);
    const normalizedStandardized = this.normalizeAddressForComparison(standardizedFull);

    // Check if there are significant differences
    return normalizedOriginal !== normalizedStandardized;
  }

  private formatAddressForComparison(candidate: SmartyStreets.usStreet.Candidate): string {
    const fullAddress = candidate.deliveryLine1 + (candidate.deliveryLine2 ? ` ${candidate.deliveryLine2}` : '') + `, ${candidate.lastLine}`;
    return this.normalizeAddressForComparison(fullAddress);
  }

  private normalizeAddressForComparison(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}