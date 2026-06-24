import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("schema adds UserStatus enum and admin-facing User fields", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /enum UserStatus \{[^}]*ACTIVE[^}]*DISABLED[^}]*\}/s);
  assert.match(schema, /status\s+UserStatus\s+@default\(ACTIVE\)/);
  assert.match(schema, /lastLoginAt\s+DateTime\?/);
  assert.match(schema, /loginCount\s+Int\s+@default\(0\)/);
  assert.match(schema, /note\s+String\?/);
});

test("migration creates the UserStatus type and adds columns", () => {
  const path = "prisma/migrations/20260624000100_user_admin_fields/migration.sql";
  assert.equal(existsSync(path), true, "migration file should exist");
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /CREATE TYPE "UserStatus"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "status"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "loginCount"/);
});

test("login blocks disabled accounts and records login activity; note stays admin-only", () => {
  const service = readFileSync("apps/api/src/modules/auth/auth.service.ts", "utf8");
  assert.match(service, /status === "DISABLED"/);
  assert.match(service, /loginCount: \{ increment: 1 \}/);
  assert.match(service, /lastLoginAt: new Date\(\)/);
  assert.match(service, /Omit<User, "passwordHash" \| "note">/);
  assert.match(service, /note: _note/);
});

test("admin users controller is guarded and exposes list/detail/update/delete", () => {
  const controller = readFileSync("apps/api/src/modules/admin/admin-users.controller.ts", "utf8");
  assert.match(controller, /@Controller\("admin\/users"\)/);
  assert.match(controller, /@UseGuards\(AdminGuard\)/);
  assert.match(controller, /@Get\(\)/);
  assert.match(controller, /@Get\(":id"\)/);
  assert.match(controller, /@Patch\(":id"\)/);
  assert.match(controller, /@Delete\(":id"\)/);
});

test("admin users service has self-protection, project counts, and a field whitelist", () => {
  const service = readFileSync("apps/api/src/modules/admin/admin-users.service.ts", "utf8");
  assert.match(service, /Cannot disable or demote your own account/);
  assert.match(service, /Cannot delete your own account/);
  assert.match(service, /_count: \{ select: \{ projects: true \} \}/);
  assert.match(service, /function pickUpdatableFields/);
});

test("update DTO whitelists fields with validation", () => {
  const dto = readFileSync("apps/api/src/modules/admin/admin-users.dto.ts", "utf8");
  assert.match(dto, /class UpdateUserDto/);
  assert.match(dto, /@IsEnum\(UserStatus\)/);
  assert.match(dto, /@IsEnum\(UserRole\)/);
  assert.match(dto, /@IsEnum\(UserPlan\)/);
});

test("admin module wires PrismaModule, AuthModule, and the admin users provider", () => {
  const mod = readFileSync("apps/api/src/modules/admin/admin.module.ts", "utf8");
  assert.match(mod, /imports:\s*\[[^\]]*AuthModule[^\]]*PrismaModule/s);
  assert.match(mod, /AdminUsersController/);
  assert.match(mod, /providers:\s*\[[^\]]*AdminUsersService/s);
});

test("Next admin proxy forwards to Nest /admin with the Bearer cookie token", () => {
  const proxy = readFileSync("lib/nest-admin-proxy.ts", "utf8");
  assert.match(proxy, /NEST_AUTH_TOKEN_COOKIE/);
  assert.match(proxy, /Authorization.*Bearer/s);
  assert.match(proxy, /\/admin\/\$\{path\}/);

  assert.equal(existsSync("app/api/admin/users/route.ts"), true);
  assert.equal(existsSync("app/api/admin/users/[id]/route.ts"), true);
});

test("admin shell gates on role ADMIN and the users page calls the admin API", () => {
  const shell = readFileSync("components/AdminShell.tsx", "utf8");
  assert.match(shell, /\/api\/auth\/me/);
  assert.match(shell, /role === "ADMIN"/);
  assert.match(shell, /\/login\?next=\/admin/);

  assert.equal(existsSync("app/admin/users/page.tsx"), true);
  const page = readFileSync("app/admin/users/page.tsx", "utf8");
  assert.match(page, /\/api\/admin\/users/);
});
