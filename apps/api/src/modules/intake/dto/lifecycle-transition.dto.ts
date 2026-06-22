import { IsOptional, IsString, MaxLength } from "class-validator";
import {
  MAX_NOTE_LENGTH,
  MAX_REASON_LENGTH,
} from "../../../common/validation-constants.js";

export const lifecycleActions = [
  "mark_started",
  "mark_blocked",
  "unblock",
  "mark_completed",
  "mark_canceled",
  "archive",
] as const;

export type LifecycleActionParam = (typeof lifecycleActions)[number];

export class LifecycleTransitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_REASON_LENGTH)
  blockedReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  completedNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_REASON_LENGTH)
  canceledReason?: string;
}
