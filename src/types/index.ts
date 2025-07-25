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

// Smarty API Response Models (based on actual API documentation)
export interface SmartyAddressResponse {
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

export interface SmartyComponents {
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

export interface SmartyMetadata {
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

export interface SmartyAnalysis {
  dpv_match_code: "Y" | "N" | "S" | "D" | "";
  dpv_footnotes?: string;
  dpv_cmra?: "Y" | "N";
  dpv_vacant?: "Y" | "N";
  dpv_no_stat?: "Y" | "N";
  active: "Y";
  footnotes?: string;
}

// Internal Provider Result Model (returned by SmartyAddressProvider)
export interface ProviderValidationResult {
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

export interface StandardizedAddress {
  street: string;
  number: string;
  city: string;
  state: string;
  zipcode: string;
  deliveryLine1: string;
  deliveryLine2?: string;
  lastLine: string;
}

export interface AddressCorrection {
  field: string;
  original: string;
  corrected: string;
}