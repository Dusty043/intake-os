import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class OverrideAssignmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  developerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  developerId?: string;
}
