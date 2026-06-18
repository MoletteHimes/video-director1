import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard asks the analyze route to save generated projects", () => {
  const dashboard = readFileSync("components/DashboardClient.tsx", "utf8");

  assert.match(dashboard, /fetch\("\/api\/analyze"/);
  assert.match(dashboard, /save:\s*true/);
  assert.doesNotMatch(dashboard, /save:\s*false/);
});

