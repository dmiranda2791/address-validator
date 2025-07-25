# Implementation Plan

- [x] 1. Create minimal working Fastify server with health check

  - Set up TypeScript project with Fastify framework
  - Create basic project structure (src/, package.json, tsconfig.json)
  - Implement simple GET /health endpoint that returns {"status": "ok"}
  - Add npm scripts for dev, build, and start
  - **Deliverable**: Running server on localhost that responds to health check
  - _Requirements: 1.1_

- [x] 2. Add POST /validate-address endpoint with mock response

  - Define core TypeScript interfaces (AddressValidationRequest, AddressValidationResponse, ValidatedAddress)
  - Create POST /validate-address endpoint that accepts {"address": "string"}
  - Return hardcoded mock response with all required fields (status, validated address, etc.)
  - Add basic request validation middleware
  - **Deliverable**: API endpoint that accepts address requests and returns mock structured responses
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Implement SmartyAddressProvider with real API integration

  - Install Smarty JavaScript SDK and Opossum circuit breaker
  - Create SmartyAddressProvider class with Smarty SDK integration
  - Define Smarty response interfaces (SmartyAddressResponse, components, metadata, analysis)
  - Implement basic address validation calling real Smarty API
  - Add configuration management for Smarty credentials and circuit breaker settings
  - **Deliverable**: Provider class that can call Smarty API and return raw responses (test with console.log)
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

- [x] 4. Add response mapping and status determination to SmartyAddressProvider

  - Implement validation status determination logic based on dpv_match_code
  - Add response mapping from Smarty format to internal AddressValidationResponse format
  - Handle empty array responses (invalid addresses)
  - Add correction detection by comparing original vs standardized addresses
  - **Deliverable**: SmartyAddressProvider returns properly formatted internal responses
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Connect SmartyAddressProvider to API endpoint

  - Create AddressValidationService that orchestrates the validation workflow
  - Replace mock response in POST /validate-address with real SmartyAddressProvider calls
  - Add US-only address restriction logic
  - Implement proper error handling and HTTP status codes
  - **Deliverable**: Fully functional API that validates real addresses through Smarty
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3_

- [ ] 6. Add comprehensive error handling and circuit breaker

  - Implement centralized error handling middleware
  - Add circuit breaker error handling (graceful degradation when circuit is open)
  - Map different error types to appropriate HTTP status codes
  - Add structured error responses with proper formatting
  - **Deliverable**: Robust API that handles all error scenarios gracefully
  - _Requirements: 1.3, 2.4, 4.2, 4.3_

- [ ] 7. Add comprehensive test suite

  - Write unit tests for SmartyAddressProvider with mocked SDK responses
  - Write unit tests for AddressValidationService with mocked provider
  - Write integration tests for API endpoints with real/mocked Smarty calls
  - Add test fixtures for various address scenarios
  - **Deliverable**: Full test coverage that can be run with npm test
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

- [ ] 8. Add production readiness features

  - Implement structured logging throughout the application
  - Add request/response logging middleware (without sensitive data)
  - Add rate limiting middleware
  - Add security headers and input sanitization
  - Configure graceful shutdown handling
  - **Deliverable**: Production-ready API with logging, security, and monitoring
  - _Requirements: 4.2, 4.3, 6.1, 6.2, 6.3_

- [ ] 9. Create comprehensive README documentation
  - Write project overview and purpose
  - Document design decisions and their benefits:
    - Adapter Pattern: Enables easy switching between validation providers, isolates external dependencies, makes testing easier with mocked implementations
    - Circuit Breaker: Prevents cascading failures, provides graceful degradation during outages, automatic recovery, protects against external API instability
    - Rate Limiting: Prevents API abuse, ensures fair usage, protects server resources, improves overall system stability
    - Smarty SDK Usage: Built-in retry logic, official support and updates, simplified integration, handles authentication and request formatting
  - Add setup and installation instructions
  - Include API usage examples with curl commands
  - Document configuration options and environment variables
  - Add troubleshooting section
  - Create Future Work section including:
    - Dockerization: Consistent deployment environments, easier scaling, simplified CI/CD, environment isolation, reproducible builds
    - Authentication & Authorization with JWTs: Secure API access, user-specific rate limiting, audit trails, role-based permissions
  - **Deliverable**: Complete project documentation for developers and operators
  - _Requirements: All requirements for comprehensive project documentation_
