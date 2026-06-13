import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const compiledDir = join(process.cwd(), ".next-test");
const modulePath = join(compiledDir, "ai-placeholder-retry.mjs");
const moduleUrl = pathToFileURL(modulePath).href;

await mkdir(compiledDir, { recursive: true });
let source = await readFile(join(process.cwd(), "lib", "ai.ts"), "utf8");
source = source
  .replace('import { buildMockAnalysis } from "@/lib/mock";', "const buildMockAnalysis = () => ({});")
  .replace(
    'import { AI_VIDEO_PROMPT_OPTIMIZER_SYSTEM_PROMPT } from "@/lib/prompt-optimizer-skill";',
    'const AI_VIDEO_PROMPT_OPTIMIZER_SYSTEM_PROMPT = "system";',
  )
  .replace(
    'import { durationSince, logger } from "@/lib/logger";',
    'const durationSince = () => 0; const logger = { info() {}, warn() {}, error() {}, debug() {} };',
  );
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
}).outputText;
await writeFile(modulePath, compiled, "utf8");

test("template placeholder errors include the exact result path and matched text", async () => {
  const { assertNoTemplatePlaceholders } = await import(moduleUrl);

  assert.throws(
    () =>
      assertNoTemplatePlaceholders({
        workflow: {
          finalPromptPackage: `镜头提示词已经完整，负面提示词${"\u540c\u4e0a"}`,
        },
      }),
    (error) => {
      assert.match(error.message, /workflow\.finalPromptPackage/);
      assert.match(error.message, /\u540c\u4e0a/);
      return true;
    },
  );
});

test("placeholder retry runs once and passes a stronger retry instruction", async () => {
  const { TemplatePlaceholderError, runWithTemplatePlaceholderRetry } = await import(moduleUrl);
  let calls = 0;
  let retryInstruction = "";

  const result = await runWithTemplatePlaceholderRetry(
    async (_attempt, instruction) => {
      calls += 1;
      if (calls === 1) {
        throw new TemplatePlaceholderError("storyboard[0].videoPrompt", "\u7565", "\u7565");
      }
      retryInstruction = instruction || "";
      return "ok";
    },
    { requestId: "test_request", provider: "test-provider" },
  );

  assert.equal(result, "ok");
  assert.equal(calls, 2);
  assert.match(retryInstruction, /storyboard\[0\]\.videoPrompt/);
  assert.match(retryInstruction, /\u7565/);
});

test("placeholder retry stops after one retry to avoid token runaway", async () => {
  const { TemplatePlaceholderError, runWithTemplatePlaceholderRetry } = await import(moduleUrl);
  let calls = 0;

  await assert.rejects(
    runWithTemplatePlaceholderRetry(
      async () => {
        calls += 1;
        throw new TemplatePlaceholderError("workflow.finalPromptPackage", "\u540c\u4e0a", "\u540c\u4e0a");
      },
      { requestId: "test_request", provider: "test-provider" },
    ),
    /workflow\.finalPromptPackage/,
  );

  assert.equal(calls, 2);
});

test("AI network fetch retry runs once and then returns a response", async () => {
  const { fetchAiProvider } = await import(moduleUrl);
  const originalFetch = globalThis.fetch;
  const originalDelay = process.env.AI_NETWORK_RETRY_DELAY_MS;
  let calls = 0;

  try {
    process.env.AI_NETWORK_RETRY_DELAY_MS = "0";
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return new Response("{}", { status: 200 });
    };

    const response = await fetchAiProvider("https://api.deepseek.com/chat/completions", { method: "POST" }, {
      requestId: "test_request",
      provider: "deepseek",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
    });

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDelay === undefined) delete process.env.AI_NETWORK_RETRY_DELAY_MS;
    else process.env.AI_NETWORK_RETRY_DELAY_MS = originalDelay;
  }
});

test("AI network fetch retry stops after one retry with a clear diagnostic error", async () => {
  const { AIProviderNetworkError, fetchAiProvider } = await import(moduleUrl);
  const originalFetch = globalThis.fetch;
  const originalDelay = process.env.AI_NETWORK_RETRY_DELAY_MS;
  let calls = 0;

  try {
    process.env.AI_NETWORK_RETRY_DELAY_MS = "0";
    globalThis.fetch = async () => {
      calls += 1;
      throw new TypeError("fetch failed");
    };

    await assert.rejects(
      fetchAiProvider("https://api.deepseek.com/chat/completions", { method: "POST" }, {
        requestId: "test_request",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        baseUrl: "https://api.deepseek.com",
      }),
      (error) => {
        assert.equal(error instanceof AIProviderNetworkError, true);
        assert.match(error.message, /deepseek/);
        assert.match(error.message, /deepseek-v4-flash/);
        assert.match(error.message, /https:\/\/api\.deepseek\.com/);
        assert.match(error.message, /proxy|VPN|firewall|AI_BASE_URL/i);
        return true;
      },
    );

    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDelay === undefined) delete process.env.AI_NETWORK_RETRY_DELAY_MS;
    else process.env.AI_NETWORK_RETRY_DELAY_MS = originalDelay;
  }
});
