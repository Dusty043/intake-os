import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { MAX_DISCOVERY_FIELD_LENGTH } from "../../../common/validation-constants.js";

// Shared by both POST /discovery (start) and POST /discovery/:id/message (follow-up) —
// same shape either way.
export class DiscoveryMessageDto {
  @ApiProperty({ example: "We need a way to track project handoffs." })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DISCOVERY_FIELD_LENGTH)
  message!: string;
}
