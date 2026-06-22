import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { ApprovalDecisionInput } from "../../../../../../src/application/types.js";
import { approvalGates, type ApprovalGate } from "../../../../../../src/domain/types.js";
import { MAX_COMMENT_LENGTH } from "../../../common/validation-constants.js";

export class ApprovalDecisionDto implements ApprovalDecisionInput {
  @ApiPropertyOptional({ enum: approvalGates, description: "Normally omitted. The API infers the open gate from the current state." })
  @IsOptional()
  @IsIn(approvalGates)
  gate?: ApprovalGate;

  @ApiPropertyOptional({ example: "Approved for POC." })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
