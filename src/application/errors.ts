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
