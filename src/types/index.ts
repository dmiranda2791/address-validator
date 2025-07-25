// HTTP Request Model
export interface ValidateAddressRequest {
  address: string;
}

// HTTP Response Model
export interface ValidateAddressResponse {
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

export type ValidationStatus = "valid" | "corrected" | "unverifiable" | "invalid";

// Core interfaces for internal use
export interface AddressValidationRequest {
  address: string;
}

export interface AddressValidationResponse {
  status: "valid" | "corrected" | "unverifiable" | "invalid";
  original?: string;
  validated?: ValidatedAddress;
  errors?: string[];
}

export interface ValidatedAddress {
  street: string;
  number: string;
  city: string;
  state: string;
  zipcode: string;
}

export interface ValidationProviderAdapter {
  validateAddress(address: string): Promise<AddressValidationResponse>;
}