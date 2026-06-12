export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class PermissionDeniedError extends ApplicationError {
  constructor(action: string) {
    super(`Permission denied for action: ${action}`);
    this.name = "PermissionDeniedError";
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ProviderInvocationError extends ApplicationError {
  constructor(provider: string, cause: string) {
    super(`AI provider "${provider}" invocation failed: ${cause}`);
    this.name = "ProviderInvocationError";
  }
}

export class ProviderResponseValidationError extends ApplicationError {
  constructor(provider: string, reason: string) {
    super(`AI provider "${provider}" returned an invalid response: ${reason}`);
    this.name = "ProviderResponseValidationError";
  }
}
