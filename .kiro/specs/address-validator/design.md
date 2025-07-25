# Design Document

## Overview

The Address Validator API is a TypeScript-based backend service built with Fastify that provides address validation and standardization capabilities. The system uses the Smarty Address Validation service as the primary validation provider and implements the Adapter pattern to allow easy switching between different validation services. The service includes robust error handling, retry mechanisms with exponential backoff plus jitter, and focuses exclusively on US address validation.

## Architecture

The system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│              API Layer                  │
│         (Fastify Routes)                │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            Service Layer                │
│      (AddressValidationService)         │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│           Adapter Layer                 │
│    (ValidationProviderAdapter)          │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          Provider Layer                 │
│      (SmartyAddressProvider)            │
└─────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Adapter Pattern**: Isolates external validation provider dependencies, enabling easy provider switching
2. **Service Layer**: Centralizes business logic and orchestrates validation workflows
3. **Smarty SDK Integration**: Uses the official Smarty JavaScript SDK which includes built-in retry logic, eliminating the need for custom retry implementation
4. **Type Safety**: Leverages TypeScript for compile-time validation and better developer experience

## Components and Interfaces

### Core Interfaces

```typescript
interface AddressValidationRequest {
  address: string;
}

interface AddressValidationResponse {
  status: "valid" | "corrected" | "unverifiable" | "invalid";
  original?: string;
  validated?: ValidatedAddress;
  errors?: string[];
}

interface ValidatedAddress {
  street: string;
  number: string;
  city: string;
  state: string;
  zipcode: string;
}

interface ValidationProviderAdapter {
  validateAddress(address: string): Promise<AddressValidationResponse>;
}
```

### Component Breakdown

#### 1. API Layer (`src/routes/`)

- **AddressValidationController**: Handles HTTP requests and responses
- **ValidationMiddleware**: Request validation and sanitization
- **ErrorHandler**: Centralized error handling and response formatting

#### 2. Service Layer (`src/services/`)

- **AddressValidationService**: Core business logic orchestration and main entry point

#### 3. Provider Layer (`src/providers/`)

- **SmartyAddressProvider**: Single class encapsulating all Smarty-specific logic including:
  - Smarty JavaScript SDK integration
  - Response mapping from Smarty format to internal models
  - Validation status determination based on Smarty analysis data
  - Error handling for Smarty-specific cases
  - Configuration management for Smarty credentials and options
- **ValidationProviderAdapter**: Abstract interface for future provider flexibility

#### 4. Utilities (`src/utils/`)

- **AddressParser**: Basic address parsing and normalization utilities
- **ValidationUtils**: Common validation helper functions

## Data Models

### Request/Response Models

```typescript
// HTTP Request Model
interface ValidateAddressRequest {
  address: string;
}

// HTTP Response Model
interface ValidateAddressResponse {
  status: ValidationStatus;
  original?: string;
  validated?: {
    street: string;
    number: string;
    city: string;
    state: string;
    zipcode: string;
  };
  corrections?: {
    field: string;
    original: string;
    corrected: string;
  }[];
  errors?: string[];
  metadata?: {
    provider: string;
    processingTime: number;
    retryCount: number;
  };
}

type ValidationStatus = "valid" | "corrected" | "unverifiable" | "invalid";
```

### Internal Models

```typescript
// Smarty API Response Model (based on actual API documentation)
interface SmartyAddressResponse {
  input_id?: string;
  input_index: number;
  candidate_index: number;
  addressee?: string;
  delivery_line_1: string;
  delivery_line_2?: string;
  last_line: string;
  delivery_point_barcode: string;
  smarty_key?: string;
  components: SmartyComponents;
  metadata: SmartyMetadata;
  analysis: SmartyAnalysis;
}

interface SmartyComponents {
  urbanization?: string;
  primary_number: string;
  street_name: string;
  street_predirection?: string;
  street_postdirection?: string;
  street_suffix?: string;
  secondary_number?: string;
  secondary_designator?: string;
  extra_secondary_number?: string;
  extra_secondary_designator?: string;
  pmb_designator?: string;
  pmb_number?: string;
  city_name: string;
  default_city_name?: string;
  state_abbreviation: string;
  zipcode: string;
  plus4_code?: string;
  delivery_point: string;
  delivery_point_check_digit: string;
}

interface SmartyMetadata {
  record_type?: "F" | "G" | "H" | "P" | "R" | "S";
  zip_type?: "Unique" | "Military" | "POBox" | "Standard";
  county_fips: string;
  county_name: string;
  carrier_route: string;
  congressional_district: string;
  building_default_indicator?: "Y" | "N";
  rdi?: "Residential" | "Commercial";
  elot_sequence?: string;
  elot_sort?: "A" | "D";
  latitude?: number;
  longitude?: number;
  coordinate_license?: number;
  precision?:
    | "Unknown"
    | "Zip5"
    | "Zip6"
    | "Zip7"
    | "Zip8"
    | "Zip9"
    | "Street"
    | "Parcel"
    | "Rooftop";
  time_zone?: string;
  utc_offset?: number;
  dst?: boolean;
}

interface SmartyAnalysis {
  dpv_match_code: "Y" | "N" | "S" | "D" | "";
  dpv_footnotes?: string;
  dpv_cmra?: "Y" | "N";
  dpv_vacant?: "Y" | "N";
  dpv_no_stat?: "Y" | "N";
  active: "Y";
  footnotes?: string;
}

// Internal Provider Result Model (returned by SmartyAddressProvider)
interface ProviderValidationResult {
  status: "valid" | "corrected" | "unverifiable" | "invalid";
  standardizedAddress?: StandardizedAddress;
  originalInput: string;
  corrections?: AddressCorrection[];
  metadata?: {
    provider: string;
    processingTime: number;
    confidence?: number;
  };
  errors?: string[];
}

interface StandardizedAddress {
  street: string;
  number: string;
  city: string;
  state: string;
  zipcode: string;
  deliveryLine1: string;
  deliveryLine2?: string;
  lastLine: string;
}
```

## SmartyAddressProvider Implementation

The `SmartyAddressProvider` class encapsulates all Smarty-specific logic in a single cohesive unit:

### Core Responsibilities

```typescript
import CircuitBreaker from "opossum";

class SmartyAddressProvider implements ValidationProviderAdapter {
  private smartyClient: SmartyClient;
  private circuitBreaker: CircuitBreaker;

  constructor(
    config: SmartyConfig,
    circuitBreakerConfig: CircuitBreakerConfig
  ) {
    // Initialize Smarty SDK client
    // Initialize Opossum circuit breaker wrapping Smarty API calls
    this.circuitBreaker = new CircuitBreaker(this.callSmartyAPI.bind(this), {
      timeout: circuitBreakerConfig.timeout,
      errorThresholdPercentage: circuitBreakerConfig.errorThresholdPercentage,
      resetTimeout: circuitBreakerConfig.resetTimeout,
    });
  }

  async validateAddress(address: string): Promise<ProviderValidationResult> {
    try {
      // 1. Call Smarty SDK through circuit breaker
      const smartyResponse = await this.circuitBreaker.fire(address);
      // 2. Handle empty array responses (invalid addresses)
      // 3. Map Smarty response to internal format
      // 4. Determine validation status using analysis data
      // 5. Extract corrections and standardized address
      // 6. Return unified result
    } catch (error) {
      // Handle circuit breaker open state and other errors
      return this.handleCircuitBreakerError(error, address);
    }
  }

  private async callSmartyAPI(
    address: string
  ): Promise<SmartyAddressResponse[]> {
    // Direct Smarty SDK call - wrapped by circuit breaker
  }

  private handleCircuitBreakerError(
    error: any,
    address: string
  ): ProviderValidationResult {
    // Handle circuit breaker open state gracefully
  }

  private determineValidationStatus(
    smartyResponse: SmartyAddressResponse[],
    originalInput: string
  ): ValidationStatus {
    // Status determination logic based on dpv_match_code
  }

  private mapToStandardizedAddress(
    smartyResult: SmartyAddressResponse
  ): StandardizedAddress {
    // Map Smarty components to our internal address format
  }

  private extractCorrections(
    original: string,
    smartyResult: SmartyAddressResponse
  ): AddressCorrection[] {
    // Compare original vs standardized to identify corrections
  }
}
```

### Validation Status Logic (Internal to SmartyAddressProvider)

- **Empty array response** → `invalid`
- **dpv_match_code: 'Y'** → `valid` or `corrected` (if changes were made)
- **dpv_match_code: 'S'** → `corrected` (secondary info ignored)
- **dpv_match_code: 'D'** → `unverifiable` (missing secondary info)
- **dpv_match_code: 'N' or ''** → `invalid`

### Key Smarty Analysis Fields (Used Internally)

- **dpv_match_code**: Primary indicator of address validity
- **dpv_vacant**: Indicates if address is currently vacant
- **dpv_no_stat**: Indicates if USPS considers address undeliverable
- **footnotes**: Detailed information about what was changed/corrected

## Error Handling

### Error Categories

1. **Validation Errors**: Invalid input format, missing required fields
2. **Provider Errors**: External API failures, rate limiting, authentication issues
3. **System Errors**: Internal service failures, configuration issues
4. **Network Errors**: Connectivity issues, timeouts

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
}
```

### Error Handling with Circuit Breaker

The Smarty JavaScript SDK handles retry logic internally, and we add circuit breaker protection:

```typescript
interface ErrorHandlingStrategy {
  // Smarty SDK handles:
  // - Network timeouts and retries
  // - Rate limiting with backoff
  // - Authentication errors
  // Opossum Circuit Breaker handles:
  // - Prevents cascading failures when Smarty API is down
  // - Fails fast when error threshold is exceeded
  // - Automatic recovery attempts after reset timeout
  // We handle:
  // - Empty response arrays (invalid addresses)
  // - Circuit breaker open state (graceful degradation)
  // - Malformed input validation
  // - Configuration errors
  // - Business logic errors
}
```

## Testing Strategy

### Unit Testing

- **Service Layer**: Mock adapter dependencies, test business logic
- **Adapter Layer**: Mock provider responses, test adaptation logic
- **Utility Functions**: Test retry mechanisms, address parsing utilities
- **Controllers**: Mock service dependencies, test HTTP handling

### Integration Testing

- **End-to-End API Tests**: Test complete request/response cycles
- **Provider Integration**: Test actual Smarty API integration (with test credentials)
- **Error Scenarios**: Test various failure modes and recovery

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   ├── adapters/
│   ├── utils/
│   └── controllers/
├── integration/
│   ├── api/
│   └── providers/
└── fixtures/
    ├── addresses/
    └── responses/
```

### Testing Tools

- **Jest**: Primary testing framework
- **Supertest**: HTTP endpoint testing
- **Nock**: HTTP mocking for external API calls
- **Test Containers**: For integration testing with external dependencies

## Configuration Management

### Environment Variables

```typescript
interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  smarty: {
    authId: string;
    authToken: string;
    licenses: string[]; // e.g., ['us-core-cloud', 'us-rooftop-geocoding-cloud']
    maxCandidates: number; // Default: 1
    matchStrategy: "strict" | "invalid" | "enhanced"; // Default: 'strict'
  };
  circuitBreaker: {
    timeout: number; // Default: 10000ms
    errorThresholdPercentage: number; // Default: 50
    resetTimeout: number; // Default: 30000ms
  };
  logging: {
    level: string;
    format: string;
  };
}
```

### Configuration Validation

- Use environment variable validation at startup
- Fail fast if required configuration is missing
- Support configuration overrides for testing

## Security Considerations

1. **API Key Management**: Secure storage and rotation of Smarty API credentials
2. **Input Validation**: Sanitize and validate all incoming address data
3. **Rate Limiting**: Implement request rate limiting to prevent abuse
4. **Logging**: Avoid logging sensitive address information
5. **HTTPS**: Enforce HTTPS for all API communications
