import CircuitBreaker from 'opossum';
import * as SmartyStreets from 'smartystreets-javascript-sdk';
import {
  ValidationProviderAdapter,
  ProviderValidationResult,
  SmartyAddressResponse,
  StandardizedAddress,
  AddressCorrection,
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

  async validateAddress(address: string): Promise<ProviderValidationResult> {
    const startTime = Date.now();
    
    try {
      // Call Smarty SDK through circuit breaker
      const smartyResponse = await this.circuitBreaker.fire(address);
      const processingTime = Date.now() - startTime;

      // Handle empty array responses (invalid addresses)
      if (!smartyResponse || smartyResponse.length === 0) {
        return {
          status: 'invalid',
          originalInput: address,
          errors: ['Address could not be validated'],
          metadata: {
            provider: 'smarty',
            processingTime,
          }
        };
      }

      // Use the first candidate (most likely match)
      const candidate = smartyResponse[0];
      
      // Map Smarty response to internal format
      const standardizedAddress = this.mapToStandardizedAddress(candidate);
      
      // Determine validation status using analysis data
      const status = this.determineValidationStatus(candidate, address);
      
      // Extract corrections if any
      const corrections = this.extractCorrections(address, candidate);

      return {
        status,
        standardizedAddress,
        originalInput: address,
        corrections,
        metadata: {
          provider: 'smarty',
          processingTime,
        }
      };

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
  ): ProviderValidationResult {
    let errorMessage = 'Address validation service temporarily unavailable';
    
    if ((error as NodeJS.ErrnoException).code === 'EOPENBREAKER') {
      errorMessage = 'Address validation service is experiencing issues - please try again later';
    } else if ('timeout' in error) {
      errorMessage = 'Address validation request timed out';
    }

    return {
      status: 'invalid',
      originalInput: address,
      errors: [errorMessage],
      metadata: {
        provider: 'smarty',
        processingTime,
      }
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
      const standardizedInput = this.formatAddressForComparison(candidate);
      const normalizedOriginal = this.normalizeAddressForComparison(originalInput);
      
      if (standardizedInput !== normalizedOriginal) {
        return 'corrected';
      }
    }

    return baseStatus;
  }

  private mapToStandardizedAddress(candidate: SmartyStreets.usStreet.Candidate): StandardizedAddress {
    const components = candidate.components;
    
    return {
      street: this.buildStreetName(components),
      number: components.primaryNumber || '',
      city: components.cityName || '',
      state: components.state || '',
      zipcode: components.zipCode + (components.plus4Code ? `-${components.plus4Code}` : ''),
      deliveryLine1: candidate.deliveryLine1 || '',
      deliveryLine2: candidate.deliveryLine2 || undefined,
      lastLine: candidate.lastLine || ''
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

  private extractCorrections(
    original: string,
    candidate: SmartyStreets.usStreet.Candidate
  ): AddressCorrection[] {
    const corrections: AddressCorrection[] = [];
    
    // This is a simplified correction extraction
    // In a full implementation, you would parse the original address
    // and compare each component with the standardized version
    
    const standardizedFull = candidate.deliveryLine1 + (candidate.deliveryLine2 ? ` ${candidate.deliveryLine2}` : '') + `, ${candidate.lastLine}`;
    const normalizedOriginal = this.normalizeAddressForComparison(original);
    const normalizedStandardized = this.normalizeAddressForComparison(standardizedFull);
    
    if (normalizedOriginal !== normalizedStandardized) {
      corrections.push({
        field: 'address',
        original: original,
        corrected: standardizedFull
      });
    }
    
    return corrections;
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