# Address Validator API

A robust, production-ready TypeScript API service for validating and standardizing US property addresses. Built with Fastify and powered by the Smarty Address Validation service, this API transforms free-form address strings into structured, validated address components.

## Overview

The Address Validator API accepts unstructured address input and returns standardized address data with validation status indicators. The service is designed specifically for US addresses and provides detailed feedback on address validity, corrections made during standardization, and comprehensive error handling for edge cases.

### Key Features

- **US Address Validation**: Validates and standardizes US addresses using Smarty's industry-leading address database
- **Structured Response Format**: Returns consistent JSON responses with street, number, city, state, and zipcode components
- **Validation Status Indicators**: Clear status codes (valid, corrected, unverifiable, invalid) with detailed feedback
- **Production-Ready**: Includes logging, rate limiting, security headers, graceful shutdown, and comprehensive error handling
- **Resilient Architecture**: Circuit breaker pattern protects against external API failures with automatic recovery
- **Developer-Friendly**: TypeScript throughout, comprehensive test suite, and clear API documentation

## Architecture & Design Decisions

### Adapter Pattern

**Benefits**: Enables easy switching between validation providers, isolates external dependencies, makes testing easier with mocked implementations

The system uses the Adapter pattern to abstract the validation provider interface, allowing seamless switching between different address validation services without changing core business logic. The `ValidationProviderAdapter` interface defines a consistent contract that any provider implementation must follow.

### Circuit Breaker Pattern

**Benefits**: Prevents cascading failures, provides graceful degradation during outages, automatic recovery, protects against external API instability

Implemented using the Opossum library, the circuit breaker wraps calls to the Smarty API. When the external service experiences issues, the circuit breaker fails fast and provides meaningful error responses instead of hanging requests. It automatically attempts recovery after a configured timeout period.

### Rate Limiting

**Benefits**: Prevents API abuse, ensures fair usage, protects server resources, improves overall system stability

Built-in rate limiting using Fastify's rate-limit plugin protects the service from abuse and ensures consistent performance. Rate limits are applied per IP address with configurable windows and limits.

### Smarty SDK Usage

**Benefits**: Built-in retry logic, official support and updates, simplified integration, handles authentication and request formatting

The official Smarty JavaScript SDK provides robust error handling, automatic retries, and simplified authentication. This reduces the complexity of our integration code and ensures we benefit from Smarty's best practices and updates.

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Smarty Address Validation API credentials ([Get them here](https://www.smarty.com/))

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd address-validator
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your Smarty API credentials
```

4. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## API Documentation

### Health Check

**GET** `/health`

Returns the service health status.

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "environment": "development"
}
```

### Address Validation

**POST** `/validate-address`

Validates and standardizes a US address.

**Request Body:**

```json
{
  "address": "1600 Amphitheatre Pkwy, Mountain View, CA"
}
```

**Example Usage:**

```bash
# Valid address
curl -X POST http://localhost:3000/validate-address \
  -H "Content-Type: application/json" \
  -d '{"address": "1600 Amphitheatre Pkwy, Mountain View, CA"}'

# Address with typos (will be corrected)
curl -X POST http://localhost:3000/validate-address \
  -H "Content-Type: application/json" \
  -d '{"address": "1600 Ampitheater Parkway, Mtn View, California"}'

# Invalid address
curl -X POST http://localhost:3000/validate-address \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Fake Street, Nowhere, XX"}'

# Partial address (missing secondary info)
curl -X POST http://localhost:3000/validate-address \
  -H "Content-Type: application/json" \
  -d '{"address": "350 5th Ave, New York, NY"}'
```

### Response Format

**Successful Response:**

```json
{
  "status": "valid",
  "original": "1600 Amphitheatre Pkwy, Mountain View, CA",
  "validated": {
    "street": "Amphitheatre Pkwy",
    "number": "1600",
    "city": "Mountain View",
    "state": "CA",
    "zipcode": "94043"
  },
  "corrections": [],
  "metadata": {
    "provider": "smarty",
    "processingTime": 245,
    "retryCount": 0
  }
}
```

**Corrected Address Response:**

```json
{
  "status": "corrected",
  "original": "1600 Ampitheater Parkway, Mtn View, California",
  "validated": {
    "street": "Amphitheatre Pkwy",
    "number": "1600",
    "city": "Mountain View",
    "state": "CA",
    "zipcode": "94043"
  },
  "corrections": [
    {
      "field": "street",
      "original": "Ampitheater Parkway",
      "corrected": "Amphitheatre Pkwy"
    },
    {
      "field": "city",
      "original": "Mtn View",
      "corrected": "Mountain View"
    }
  ],
  "metadata": {
    "provider": "smarty",
    "processingTime": 312,
    "retryCount": 0
  }
}
```

### Status Codes

- **`valid`**: Address was validated successfully without changes
- **`corrected`**: Address was validated but required corrections (typos, abbreviations, etc.)
- **`unverifiable`**: Address components are valid but cannot be fully verified (e.g., missing apartment number)
- **`invalid`**: Address could not be validated or standardized

### Error Responses

**400 Bad Request:**

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Address field is required and must be a non-empty string",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "abc123def456"
  }
}
```

**429 Rate Limited:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "abc123def456",
    "details": {
      "limit": 100,
      "window": "15 minutes",
      "remaining": 45000
    }
  }
}
```

**503 Service Unavailable:**

```json
{
  "error": {
    "code": "EXTERNAL_SERVICE_UNAVAILABLE",
    "message": "Address validation service is temporarily unavailable",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "abc123def456"
  }
}
```

## Configuration

The application is configured through environment variables. Copy `.env.example` to `.env` and customize as needed.

### Environment Variables

#### Server Configuration

| Variable   | Default       | Description                                |
| ---------- | ------------- | ------------------------------------------ |
| `PORT`     | `3000`        | Server port                                |
| `HOST`     | `localhost`   | Server host (use `0.0.0.0` for production) |
| `NODE_ENV` | `development` | Environment mode                           |

#### Smarty API Configuration

| Variable                | Required | Default         | Description                                        |
| ----------------------- | -------- | --------------- | -------------------------------------------------- |
| `SMARTY_AUTH_ID`        | ✅       | -               | Your Smarty Auth ID                                |
| `SMARTY_AUTH_TOKEN`     | ✅       | -               | Your Smarty Auth Token                             |
| `SMARTY_LICENSES`       |          | `us-core-cloud` | Comma-separated list of Smarty licenses            |
| `SMARTY_MAX_CANDIDATES` |          | `1`             | Maximum address candidates to return               |
| `SMARTY_MATCH_STRATEGY` |          | `strict`        | Match strategy: `strict`, `invalid`, or `enhanced` |

#### Circuit Breaker Configuration

| Variable                          | Default | Description                       |
| --------------------------------- | ------- | --------------------------------- |
| `CIRCUIT_BREAKER_TIMEOUT`         | `10000` | Request timeout in milliseconds   |
| `CIRCUIT_BREAKER_ERROR_THRESHOLD` | `50`    | Error percentage to open circuit  |
| `CIRCUIT_BREAKER_RESET_TIMEOUT`   | `30000` | Time before attempting reset (ms) |

#### Rate Limiting Configuration

| Variable            | Default      | Description                 |
| ------------------- | ------------ | --------------------------- |
| `RATE_LIMIT_MAX`    | `100`        | Maximum requests per window |
| `RATE_LIMIT_WINDOW` | `15 minutes` | Rate limiting time window   |

#### Logging Configuration

| Variable     | Default | Description                                 |
| ------------ | ------- | ------------------------------------------- |
| `LOG_LEVEL`  | `info`  | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `json`  | Log format: `json` or `pretty`              |

### Getting Smarty API Credentials

1. Sign up at [Smarty.com](https://www.smarty.com/)
2. Navigate to your account dashboard
3. Generate API keys for the US Address Validation API
4. Add the `us-core-cloud` license to your account
5. Use the Auth ID and Auth Token in your environment configuration

## Development

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

### Project Structure

```
src/
├── config/           # Configuration management
├── errors/           # Custom error classes
├── middleware/       # Express middleware
├── providers/        # Address validation providers
├── services/         # Business logic services
├── types/           # TypeScript type definitions
└── index.ts         # Application entry point

__tests__/
├── fixtures/        # Test data and mocks
├── integration/     # Integration tests
├── providers/       # Provider unit tests
├── services/        # Service unit tests
└── setup.ts        # Test configuration
```

### Running Tests

The project includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test -- AddressValidationService.test.ts

# Run tests in watch mode during development
npm test -- --watch
```

## Troubleshooting

### Common Issues

#### "Required environment variable SMARTY_AUTH_ID is not set"

**Solution**: Ensure you've copied `.env.example` to `.env` and added your Smarty API credentials.

#### "External service unavailable" errors

**Possible causes**:

- Invalid Smarty API credentials
- Smarty service outage
- Network connectivity issues
- Rate limiting from Smarty

**Solutions**:

1. Verify your Smarty credentials are correct
2. Check Smarty's status page for service outages
3. Ensure your server can reach external APIs
4. Review your Smarty account usage limits

#### Rate limiting errors

**Solution**: The API includes built-in rate limiting (100 requests per 15 minutes by default). Adjust `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` environment variables if needed.

#### Circuit breaker is open

**Cause**: Too many failures to the Smarty API have triggered the circuit breaker.
**Solution**: Wait for the reset timeout period, or check Smarty service status. The circuit breaker will automatically attempt to close after the configured reset timeout.

#### Memory or performance issues

**Solutions**:

- Monitor logs for unusual patterns
- Adjust circuit breaker timeouts if needed
- Consider scaling horizontally for high traffic
- Review rate limiting configuration

### Debugging

Enable debug logging for detailed request/response information:

```bash
LOG_LEVEL=debug npm run dev
```

This will show:

- Incoming request details
- Address validation processing steps
- External API call timing
- Circuit breaker state changes
- Detailed error information

### Health Monitoring

The `/health` endpoint provides basic service status. For production monitoring, consider:

- Setting up alerts on HTTP 5xx responses
- Monitoring the `/health` endpoint availability
- Tracking response times for the validation endpoint
- Monitoring circuit breaker state changes in logs

## Future Work

### Dockerization

**Benefits**: Consistent deployment environments, easier scaling, simplified CI/CD, environment isolation, reproducible builds

Containerizing the application would provide:

- Consistent runtime environment across development, staging, and production
- Simplified deployment process with container orchestration platforms
- Better resource isolation and management
- Easier horizontal scaling with container orchestration
- Simplified CI/CD pipeline integration

**Implementation considerations**:

- Multi-stage Docker build for optimized production images
- Health check integration for container orchestration
- Proper handling of environment variables and secrets
- Non-root user execution for security

### Authentication & Authorization with JWTs

**Benefits**: Secure API access, user-specific rate limiting, audit trails, role-based permissions

Adding authentication would enable:

- Secure API access with JWT token validation
- User-specific rate limiting and usage tracking
- Detailed audit trails for compliance requirements
- Role-based access control for different API features
- Integration with existing identity providers

**Implementation considerations**:

- JWT token validation middleware
- User management and role assignment
- Rate limiting per authenticated user
- Audit logging for security compliance
- Integration with OAuth2/OpenID Connect providers

### Additional Enhancements

- **Caching Layer**: Redis-based caching for frequently validated addresses
- **Metrics & Monitoring**: Prometheus metrics and Grafana dashboards
- **Multiple Provider Support**: Fallback to secondary validation providers
- **Batch Processing**: Support for validating multiple addresses in a single request
- **Webhook Support**: Async validation with callback URLs
- **Geographic Data**: Enhanced location data including coordinates and timezone information

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions, issues, or contributions:

- Create an issue in the GitHub repository
- Review the troubleshooting section above
- Check the Smarty API documentation for provider-specific questions

---

**Built using TypeScript, Fastify, and Smarty Address Validation**
