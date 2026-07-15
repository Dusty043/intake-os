import {
  ArgumentsHost,
  BadRequestException,
  BadGatewayException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ConfigurationError,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  ProviderInvocationError,
  ProviderResponseValidationError,
  ValidationError,
} from "../../../../src/application/errors.js";
import { InvalidTransitionError, WorkflowGuardError } from "../../../../src/domain/workflow.js";

@Catch(Error)
export class ApplicationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApplicationExceptionFilter.name);

  catch(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const httpError = toHttpError(error);
    const status = httpError.getStatus();
    const body = httpError.getResponse();

    // Unrecognized errors fall through to a generic 500 with no caller-visible
    // detail (toHttpError's default branch) — log the real error server-side,
    // otherwise it's unrecoverable: the client only ever sees "Unexpected
    // application error."
    if (status >= 500) {
      this.logger.error(error.message, error.stack);
    }

    response.status(status).json(
      typeof body === "string"
        ? {
            statusCode: status,
            error: httpError.name,
            message: body,
          }
        : body,
    );
  }
}

function toHttpError(error: Error) {
  if (error instanceof HttpException) {
    return error;
  }

  if (error instanceof NotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof PermissionDeniedError) {
    return new ForbiddenException(error.message);
  }

  if (error instanceof ConflictError) {
    return new ConflictException(error.message);
  }

  if (error instanceof ConfigurationError) {
    return new InternalServerErrorException(error.message);
  }

  if (error instanceof ProviderInvocationError || error instanceof ProviderResponseValidationError) {
    return new BadGatewayException(error.message);
  }

  if (error instanceof ValidationError || error instanceof InvalidTransitionError || error instanceof WorkflowGuardError) {
    return new BadRequestException(error.message);
  }

  return new InternalServerErrorException("Unexpected application error.");
}
