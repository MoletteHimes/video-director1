import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";

/**
 * Extends JwtAuthGuard: first verifies the Bearer JWT (which populates
 * request.user with { id, role, plan }), then requires role === "ADMIN".
 * Use on every /api/admin/* endpoint that manages platform data.
 */
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== "ADMIN") {
      throw new ForbiddenException("Administrator access required");
    }
    return true;
  }
}
