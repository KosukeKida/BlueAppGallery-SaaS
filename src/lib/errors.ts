export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class SnowflakeApiError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'SNOWFLAKE_API_ERROR', 502, details);
    this.name = 'SnowflakeApiError';
  }
}

export class TenantNotFoundError extends AppError {
  constructor() {
    super('Tenant not found', 'TENANT_NOT_FOUND', 404);
    this.name = 'TenantNotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}
