import { Controller, Get } from "@nestjs/common";
import { ok } from "../../common/api-response";

@Controller("usage")
export class UsageController {
  @Get("summary")
  getSummary() {
    return ok({
      events: [],
      note: "Usage module skeleton. Track AI cost, credits, and rate limits here.",
    });
  }
}
