const { GraphQLError } = require('graphql');

const ERROR_STATUS_BY_CODE = {
  BAD_USER_INPUT: 400,
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  TENANT_SCOPE_VIOLATION: 403,
  NOT_FOUND: 404,
  NAME_ALREADY_EXISTS: 409,
  SEED_IMMUTABLE: 409,
  CONFLICT: 409,
  EMAIL_SEND_FAILED: 502,
  EMAIL_CONFIG_MISSING: 500,
  CONFIG_ERROR: 500,
  INTERNAL_SERVER_ERROR: 500,
};

function getStatusForCode(code) {
  if (typeof code !== 'string') {
    return 500;
  }

  return ERROR_STATUS_BY_CODE[code] || 500;
}

class AppError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'AppError';
    const resolvedStatus = status || getStatusForCode(code);
    this.extensions = {
      code,
      http: {
        status: resolvedStatus,
      },
    };
  }
}

class DomainError extends AppError {
  constructor(code, message) {
    super(code, message);
    this.name = 'DomainError';
  }
}

class AuthenticationError extends AppError {
  constructor(message) {
    super('UNAUTHENTICATED', message, 401);
    this.name = 'AuthenticationError';
  }
}

class UserInputError extends AppError {
  constructor(message) {
    super('BAD_USER_INPUT', message, 400);
    this.name = 'UserInputError';
  }
}

class InfrastructureError extends AppError {
  constructor(code, message) {
    super(code || 'INTERNAL_SERVER_ERROR', message, getStatusForCode(code));
    this.name = 'InfrastructureError';
  }
}

function toGraphQLError(error) {
  if (error instanceof GraphQLError) {
    return error;
  }

  const code = error?.extensions?.code;
  const message = typeof error?.message === 'string' ? error.message : 'Unexpected error.';
  const extensions = {
    ...(error?.extensions || {}),
    code: code || 'INTERNAL_SERVER_ERROR',
    http: {
      status: error?.extensions?.http?.status || getStatusForCode(code || 'INTERNAL_SERVER_ERROR'),
    },
  };

  return new GraphQLError(message, null, null, null, null, error, extensions);
}

function maskGraphQLError(error) {
  const code = error?.extensions?.code;
  if (typeof code === 'string' && code !== 'INTERNAL_SERVER_ERROR') {
    return toGraphQLError(error);
  }

  return new GraphQLError(
    'Unexpected error.',
    null,
    null,
    null,
    null,
    error instanceof Error ? error : undefined,
    {
      code: 'INTERNAL_SERVER_ERROR',
      http: {
        status: 500,
      },
    }
  );
}

module.exports = {
  AppError,
  DomainError,
  AuthenticationError,
  UserInputError,
  InfrastructureError,
  toGraphQLError,
  maskGraphQLError,
};
