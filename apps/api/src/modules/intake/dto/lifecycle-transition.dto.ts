import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

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
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  blockedReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  completedNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  canceledReason?: string;
}
