import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RequestChangesDto {
  @ApiProperty({ example: "Infrastructure requirements need clarification before DevOps can sign off." })
  @IsString()
  @MinLength(1)
  reason!: string;
}
