import { BadRequestException, applyDecorators } from "@nestjs/common";
import { Transform, plainToInstance } from "class-transformer";
import { IsOptional, IsString, MaxLength, validate } from "class-validator";
import {
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_EXTERNAL_ID_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_INTAKE_TITLE_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MAX_URL_LENGTH,
} from "../../../common/validation-constants.js";

// Bitrix24 sends numeric CRM ids (e.g. `ID: 4521`) for some of these fields —
// `normalizeBitrix24IntakePayload` already tolerates that (see bitrix24-adapter.ts's
// `firstString`), so coerce finite numbers to strings before length-checking them.
function bitrixTextField(maxLength: number) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === "number" && Number.isFinite(value) ? String(value) : value,
    ),
    IsOptional(),
    IsString(),
    MaxLength(maxLength),
  );
}

/**
 * Bounds the handful of fields `normalizeBitrix24IntakePayload` reads out of a Bitrix24 payload
 * (see `src/application/bitrix24-adapter.ts`) — one property per key variant it checks. The
 * controller's `@Body()` param stays `Record<string, unknown>`: a real Bitrix24 webhook carries
 * dozens of other CRM fields this app doesn't read but stores as-is in `source.rawPayload`, so a
 * strict class-validator DTO (whitelist + forbidNonWhitelisted, as the global ValidationPipe uses)
 * would reject legitimate payloads. This DTO is validated manually (`assertValidBitrix24Payload`)
 * purely to cap the length of the fields that actually flow into DB columns (title, description,
 * requester, department) via the created intake — it never strips or rejects unknown fields.
 */
export class Bitrix24IntakePayloadDto {
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) ID?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) id?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) dealId?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) taskId?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) entityId?: string;

  @bitrixTextField(MAX_INTAKE_TITLE_LENGTH) TITLE?: string;
  @bitrixTextField(MAX_INTAKE_TITLE_LENGTH) title?: string;
  @bitrixTextField(MAX_INTAKE_TITLE_LENGTH) NAME?: string;
  @bitrixTextField(MAX_INTAKE_TITLE_LENGTH) name?: string;
  @bitrixTextField(MAX_INTAKE_TITLE_LENGTH) SUBJECT?: string;
  @bitrixTextField(MAX_INTAKE_TITLE_LENGTH) subject?: string;

  @bitrixTextField(MAX_INTAKE_DESCRIPTION_LENGTH) COMMENTS?: string;
  @bitrixTextField(MAX_INTAKE_DESCRIPTION_LENGTH) comments?: string;
  @bitrixTextField(MAX_INTAKE_DESCRIPTION_LENGTH) DESCRIPTION?: string;
  @bitrixTextField(MAX_INTAKE_DESCRIPTION_LENGTH) description?: string;
  @bitrixTextField(MAX_INTAKE_DESCRIPTION_LENGTH) DETAIL_TEXT?: string;
  @bitrixTextField(MAX_INTAKE_DESCRIPTION_LENGTH) detailText?: string;

  @bitrixTextField(MAX_REQUESTER_NAME_LENGTH) CONTACT_NAME?: string;
  @bitrixTextField(MAX_REQUESTER_NAME_LENGTH) contactName?: string;
  @bitrixTextField(MAX_REQUESTER_NAME_LENGTH) CREATED_BY_NAME?: string;
  @bitrixTextField(MAX_REQUESTER_NAME_LENGTH) createdByName?: string;
  @bitrixTextField(MAX_REQUESTER_NAME_LENGTH) ASSIGNED_BY_NAME?: string;
  @bitrixTextField(MAX_REQUESTER_NAME_LENGTH) assignedByName?: string;

  @bitrixTextField(MAX_DEPARTMENT_NAME_LENGTH) DEPARTMENT?: string;
  @bitrixTextField(MAX_DEPARTMENT_NAME_LENGTH) department?: string;
  @bitrixTextField(MAX_DEPARTMENT_NAME_LENGTH) UF_DEPARTMENT?: string;
  @bitrixTextField(MAX_DEPARTMENT_NAME_LENGTH) ufDepartment?: string;

  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) PROJECT_TYPE?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) projectType?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) UF_PROJECT_TYPE?: string;
  @bitrixTextField(MAX_EXTERNAL_ID_LENGTH) ufProjectType?: string;

  @bitrixTextField(MAX_URL_LENGTH) URL?: string;
  @bitrixTextField(MAX_URL_LENGTH) url?: string;
  @bitrixTextField(MAX_URL_LENGTH) LINK?: string;
  @bitrixTextField(MAX_URL_LENGTH) link?: string;
}

/**
 * Validates only the known, length-bounded fields above and throws a 400 if any exceed their
 * limit. Deliberately permissive (`whitelist: false`) — unknown Bitrix24 CRM fields pass through
 * untouched to `normalizeBitrix24IntakePayload`, which stores the full raw payload.
 */
export async function assertValidBitrix24Payload(payload: Record<string, unknown>): Promise<void> {
  const dto = plainToInstance(Bitrix24IntakePayloadDto, payload);
  const errors = await validate(dto, { whitelist: false, forbidNonWhitelisted: false });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new BadRequestException(messages.length > 0 ? messages : "Invalid Bitrix24 payload");
  }
}
