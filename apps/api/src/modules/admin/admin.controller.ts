import { Controller, Get } from "@nestjs/common";
import { ok } from "../../common/api-response";

@Controller("admin")
export class AdminController {
  @Get("status")
  getStatus() {
    return ok({
      enabled: true,
      note: "Admin module skeleton. Move material management and user/order admin here later.",
    });
  }
}
