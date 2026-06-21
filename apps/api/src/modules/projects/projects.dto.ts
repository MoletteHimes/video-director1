import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

export class CreateStoryboardShotDto {
  @IsNumber()
  shotNumber!: number;

  @IsOptional()
  @IsString()
  scene?: string;

  @IsOptional()
  @IsString()
  visual?: string;

  @IsOptional()
  @IsString()
  shotType?: string;

  @IsOptional()
  @IsString()
  cameraMovement?: string;

  @IsOptional()
  @IsString()
  emotion?: string;

  @IsOptional()
  @IsString()
  transition?: string;

  @IsOptional()
  @IsString()
  firstFramePrompt?: string;

  @IsOptional()
  @IsString()
  videoPrompt?: string;

  @IsOptional()
  @IsString()
  lastFramePrompt?: string;

  @IsOptional()
  @IsString()
  negativePrompt?: string;
}

export class CreateProjectDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsString()
  originalScript!: string;

  @IsOptional()
  @IsString()
  optimizedScript?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  storyboardImageUrl?: string;

  @IsOptional()
  @IsString()
  storyboardImagePrompt?: string;

  @IsOptional()
  @IsString()
  fullVideoPrompt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStoryboardShotDto)
  shots!: CreateStoryboardShotDto[];
}

export class SaveStoryboardImageDto {
  @IsString()
  storyboardImageUrl!: string;

  @IsOptional()
  @IsString()
  storyboardImagePrompt?: string;
}
