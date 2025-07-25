# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Address Validator is a TypeScript-based backend API service built with Fastify that validates and standardizes US property addresses. It accepts free-form address strings and returns structured, validated addresses with clear status indicators.

## Key Design Reference

ALWAYS consider the design file for this project, it's located at: `.kiro/specs/address-validator/design.md`

The complete project specifications are in `.kiro/specs/address-validator/`:
- `requirements.md` - Business requirements and user stories
- `design.md` - Technical architecture and interfaces 
- `tasks.md` - Implementation roadmap with 9 planned tasks

## Development Commands

```bash
# Development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build  

# Run production server
npm start

# Run tests (when implemented)
npm test
```

## Architecture

The system follows a **layered architecture** with clear separation of concerns:

```
API Layer (Fastify Routes)
    ↓
Service Layer (AddressValidationService) 
    ↓
Adapter Layer (ValidationProviderAdapter)
    ↓
Provider Layer (SmartyAddressProvider)
```

### Key Architectural Patterns

- **Adapter Pattern**: Enables switching between validation providers without code changes
- **Circuit Breaker Pattern**: Uses Opossum library for resilience against external API failures
- **Service Layer Pattern**: Centralizes business logic and orchestrates validation workflows

### External Dependencies

- **Smarty Address Validation API**: Primary validation provider with built-in retry logic
- **Fastify**: Web framework chosen for TypeScript support and performance
- **Opossum**: Circuit breaker library (planned for Task 6)

## Core API Interfaces

Based on the design specification, all types are defined in `src/types/index.ts`:

**HTTP Request/Response:**
```typescript
interface ValidateAddressRequest {
  address: string;
}

interface ValidateAddressResponse {
  status: ValidationStatus; // "valid" | "corrected" | "unverifiable" | "invalid"
  original?: string;
  validated?: ValidatedAddress;
  corrections?: AddressCorrection[];
  errors?: string[];
  metadata?: ResponseMetadata;
}
```

**Internal Core Types:**
```typescript
interface ValidationProviderAdapter {
  validateAddress(address: string): Promise<AddressValidationResponse>;
}
```

## Current Implementation Status

**Completed (Tasks 1-2):**
- ✅ Minimal Fastify server with health check
- ✅ POST /validate-address endpoint with mock responses
- ✅ TypeScript interfaces from design spec
- ✅ Basic request validation middleware

**Next Steps (Tasks 3-9):**
- SmartyAddressProvider with real API integration
- Response mapping and status determination  
- Error handling and circuit breaker
- Comprehensive test suite
- Production readiness features

## Key Constraints

- **US addresses only** - Non-US addresses should return appropriate errors
- **Four validation statuses**: valid, corrected, unverifiable, invalid
- **Graceful degradation** required for external API failures
- **Type safety** throughout with comprehensive TypeScript usage

## Current API Endpoints

```bash
# Health check
GET /health
Response: {"status": "ok"}

# Address validation (currently returns mock data)
POST /validate-address
Body: {"address": "123 Main St, Springfield, IL"}
Response: ValidateAddressResponse with mock data
```

## Testing Strategy (Planned)

- **Unit Tests**: Mock dependencies, test business logic
- **Integration Tests**: End-to-end API testing with real/mocked Smarty calls  
- **Test Structure**: `tests/unit/`, `tests/integration/`, `tests/fixtures/`
- **Tools**: Jest, Supertest, Nock for HTTP mocking

## Configuration (Planned)

Environment variables for:
- Smarty API credentials (`SMARTY_AUTH_ID`, `SMARTY_AUTH_TOKEN`)
- Circuit breaker settings (timeout, error threshold, reset timeout)
- Server configuration (port, host)
- Logging configuration

## TypeScript Best Practices

- **Avoid the use of `any` as type**