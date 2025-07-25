import CircuitBreaker from 'opossum';
import * as SmartyStreets from 'smartystreets-javascript-sdk';
import {
  ValidationProviderAdapter,
  AddressValidationResponse,
  ValidatedAddress,
  ValidationStatus
} from '../types';

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
    const startTime = Date.now();
    
    try {
      // Call Smarty SDK through circuit breaker
      const smartyResponse = await this.circuitBreaker.fire(address);
      const processingTime = Date.now() - startTime;

      // Handle empty array responses (invalid addresses)
      if (!smartyResponse || smartyResponse.length === 0) {
        return {
          status: 'invalid',
          original: address,
          errors: ['Address could not be validated']
        };
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
      // Handle circuit breaker open state and other errors
      return this.handleCircuitBreakerError(error as Error, address, Date.now() - startTime);
    }
  }

  private async callSmartyAPI(address: string): Promise<SmartyStreets.usStreet.Candidate[]> {
    const lookup = new SmartyStreets.usStreet.Lookup();
    lookup.street = address;
    
    if (this.config.maxCandidates) {
      lookup.maxCandidates = this.config.maxCandidates;
    }

    return new Promise((resolve, reject) => {
      this.smartyClient.send(lookup).then((batch) => {
        if (lookup.result && lookup.result.length > 0) {
          resolve(lookup.result);
        } else {
          resolve([]);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  private handleCircuitBreakerError(
    error: Error,
    address: string,
    processingTime: number
  ): AddressValidationResponse {
    let errorMessage = 'Address validation service temporarily unavailable';
    
    if ((error as NodeJS.ErrnoException).code === 'EOPENBREAKER') {
      errorMessage = 'Address validation service is experiencing issues - please try again later';
    } else if ('timeout' in error) {
      errorMessage = 'Address validation request timed out';
    }

    return {
      status: 'invalid',
      original: address,
      errors: [errorMessage]
    };
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