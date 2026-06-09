import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { NotFoundError, PermissionDeniedError, ValidationError } from "../../../../src/application/errors.js";
import { InvalidTransitionError, WorkflowGuardError } from "../../../../src/domain/workflow.js";

@Catch(Error)
export class ApplicationExceptionFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const httpError = toHttpError(error);
    const status = httpError.getStatus();
    const body = httpError.getResponse();

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

  if (error instanceof ValidationError || error instanceof InvalidTransitionError || error instanceof WorkflowGuardError) {
    return new BadRequestException(error.message);
  }

  return new InternalServerErrorException("Unexpected application error.");
}
