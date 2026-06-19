import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class MarkResolvedDto {
  @ApiPropertyOptional({ example: "Manually verified record was created in Monday successfully." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
