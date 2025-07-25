import * as SmartyStreets from 'smartystreets-javascript-sdk';

// Test address inputs
export const testAddresses = {
  valid: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
  validWithTypo: '1600 Ampitheater Pkwy, Mountain View, CA',
  invalidComplete: 'This is not a real address at all',
  empty: '',
  whitespace: '   ',
  partial: '123 Main St',
  international: '10 Downing Street, London, UK', // Should be invalid for US-only
} as const;

// Create helper function to build mock Smarty candidates with only the fields we need
function createMockCandidate(overrides: Partial<SmartyStreets.usStreet.Candidate> = {}): SmartyStreets.usStreet.Candidate {
  const defaultCandidate: Partial<SmartyStreets.usStreet.Candidate> = {
    inputIndex: 0,
    candidateIndex: 1,
    addressee: '',
    deliveryLine1: '',
    deliveryLine2: '',
    lastLine: '',
    deliveryPointBarcode: '',
    components: {
      primaryNumber: '',
      streetName: '',
      streetSuffix: '',
      cityName: '',
      defaultCityName: '',
      state: '',
      zipCode: '',
      plus4Code: '',
      deliveryPoint: '',
      deliveryPointCheckDigit: '',
      // Add all required fields with empty defaults
      extraSecondaryDesignator: '',
      extraSecondaryNumber: '',
      pmbDesignator: '',
      pmbNumber: '',
      secondaryDesignator: '',
      secondaryNumber: '',
      streetPredirection: '',
      streetPostdirection: '',
      urbanization: ''
    },
    metadata: {
      recordType: 'S',
      zipType: 'Standard',
      countyFips: '',
      countyName: '',
      carrierRoute: '',
      congressionalDistrict: '',
      buildingDefaultIndicator: false,
      precision: 'Zip9',
      coordinateLicense: '',
      elotSequence: '',
      elotSort: 'A',
      latitude: 0,
      longitude: 0,
      obeysDst: false,
      rdi: '',
      timeZone: '',
      utcOffset: 0
    },
    analysis: {
      dpvMatchCode: 'Y',
      dpvFootnotes: '',
      cmra: 'N',
      vacant: 'N',
      active: 'Y',
      isEwsMatch: false,
      footnotes: '',
      isSuiteLinkMatch: false,
      lacsLinkCode: '',
      lacsLinkIndicator: 'N',
      noStat: ''
    }
  };

  return { ...defaultCandidate, ...overrides } as SmartyStreets.usStreet.Candidate;
}

// Mock Smarty SDK responses using proper mock candidates
export const mockSmartyResponses = {
  validAddress: [
    createMockCandidate({
      deliveryLine1: '1600 Amphitheatre Pkwy',
      lastLine: 'Mountain View CA 94043-1351',
      deliveryPointBarcode: '940431351006',
      components: {
        primaryNumber: '1600',
        streetName: 'Amphitheatre',
        streetSuffix: 'Pkwy',
        cityName: 'Mountain View',
        defaultCityName: 'Mountain View',
        state: 'CA',
        zipCode: '94043',
        plus4Code: '1351',
        deliveryPoint: '00',
        deliveryPointCheckDigit: '6',
        extraSecondaryDesignator: '',
        extraSecondaryNumber: '',
        pmbDesignator: '',
        pmbNumber: '',
        secondaryDesignator: '',
        secondaryNumber: '',
        streetPredirection: '',
        streetPostdirection: '',
        urbanization: '',
      },
      analysis: {
        dpvMatchCode: 'Y',
        dpvFootnotes: 'AABB',
        cmra: 'N',
        vacant: 'N',
        active: 'Y',
        isEwsMatch: false,
        footnotes: '',
        isSuiteLinkMatch: false,
        lacsLinkCode: '',
        lacsLinkIndicator: 'N',
        noStat: ''
      }
    })
  ],

  correctedAddress: [
    createMockCandidate({
      deliveryLine1: '1600 Amphitheatre Pkwy',
      lastLine: 'Mountain View CA 94043-1351',
      components: {
        primaryNumber: '1600',
        streetName: 'Amphitheatre',
        streetSuffix: 'Pkwy',
        cityName: 'Mountain View',
        defaultCityName: 'Mountain View',
        state: 'CA',
        zipCode: '94043',
        plus4Code: '1351',
        deliveryPoint: '00',
        deliveryPointCheckDigit: '6',
        extraSecondaryDesignator: '',
        extraSecondaryNumber: '',
        pmbDesignator: '',
        pmbNumber: '',
        secondaryDesignator: '',
        secondaryNumber: '',
        streetPredirection: '',
        streetPostdirection: '',
        urbanization: '',
      }
    })
  ],

  partialAddress: [
    createMockCandidate({
      deliveryLine1: '123 Main St',
      lastLine: 'Mountain View CA 94043-1351',
      components: {
        primaryNumber: '123',
        streetName: 'Main',
        streetSuffix: 'St',
        cityName: 'Mountain View',
        defaultCityName: 'Mountain View',
        state: 'CA',
        zipCode: '94043',
        plus4Code: '1351',
        deliveryPoint: '00',
        deliveryPointCheckDigit: '6',
        extraSecondaryDesignator: '',
        extraSecondaryNumber: '',
        pmbDesignator: '',
        pmbNumber: '',
        secondaryDesignator: '',
        secondaryNumber: '',
        streetPredirection: '',
        streetPostdirection: '',
        urbanization: '',
      },
      analysis: {
        dpvMatchCode: 'D', // Missing secondary info
        dpvFootnotes: 'M1',
        cmra: 'N',
        vacant: 'N',
        active: 'Y',
        isEwsMatch: false,
        footnotes: '',
        isSuiteLinkMatch: false,
        lacsLinkCode: '',
        lacsLinkIndicator: 'N',
        noStat: ''
      }
    })
  ],

  invalidAddress: []
};

// Expected internal responses
export const expectedResponses = {
  valid: {
    status: 'valid' as const,
    original: testAddresses.valid,
    validated: {
      street: 'Amphitheatre Pkwy',
      number: '1600',
      city: 'Mountain View',
      state: 'CA',
      zipcode: '94043-1351'
    },
    errors: []
  },
  
  corrected: {
    status: 'corrected' as const,
    original: testAddresses.validWithTypo,
    validated: {
      street: 'Amphitheatre Pkwy',
      number: '1600',
      city: 'Mountain View',
      state: 'CA',
      zipcode: '94043-1351'
    },
    errors: []
  },

  unverifiable: {
    status: 'unverifiable' as const,
    original: testAddresses.partial,
    validated: {
      street: 'Main St',
      number: '123',
      city: 'Mountain View',
      state: 'CA',
      zipcode: '94043-1351'
    },
    errors: []
  }
};