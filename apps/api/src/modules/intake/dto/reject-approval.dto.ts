import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RejectApprovalDto {
  @ApiProperty({ example: "Scope is not ready for implementation." })
  @IsString()
  @MinLength(1)
  reason!: string;
}
