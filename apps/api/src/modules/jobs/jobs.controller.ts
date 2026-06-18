import { Controller, Get } from "@nestjs/common";
import { ok } from "../../common/api-response";
import { AI_GENERATION_QUEUE } from "./jobs.module";

@Controller("jobs")
export class JobsController {
  @Get("status")
  getStatus() {
    return ok({
      queues: [AI_GENERATION_QUEUE],
      note: "Jobs module skeleton. Add BullMQ processors for long AI/image/video tasks.",
    });
  }
}
