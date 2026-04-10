import { IsArray, IsOptional, IsString } from "class-validator";

export class CreateRoleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}
