import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";

export const AI_GENERATION_QUEUE = "ai-generation";

@Module({
  imports: [BullModule.registerQueue({ name: AI_GENERATION_QUEUE })],
  controllers: [JobsController],
})
export class JobsModule {}
