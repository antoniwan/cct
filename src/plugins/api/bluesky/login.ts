import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import chalk from "chalk";

import type { Command } from "../../../core/types.js";
import { createAgent, saveAgentSession } from "./client.js";

type LoginPayload = {
  identifier: string;
  appPassword: string;
  service: string;
};

function openBrowser(url: string): void {
  const platform = process.platform;
  const opener =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(opener, [url], { detached: true, stdio: "ignore", shell: platform === "win32" }).unref();
}

function renderLoginPage(code: string, defaultService: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Bluesky Login</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; max-width: 680px; }
      input { width: 100%; margin: 0.4rem 0 1rem; padding: 0.5rem; }
      button { padding: 0.6rem 1rem; }
      code { background: #f5f5f5; padding: 0.2rem 0.4rem; }
      .actions a { margin-right: 0.75rem; }
    </style>
  </head>
  <body>
    <h1>Connect Bluesky</h1>
    <p>This form submits credentials directly to your local CLI listener.</p>
    <p class="actions">
      <a href="https://bsky.app/settings/account" target="_blank" rel="noopener noreferrer">Find my handle/email</a>
      <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">Create app password</a>
    </p>
    <form method="POST" action="/callback">
      <input type="hidden" name="code" value="${code}" />
      <label>Handle or email</label>
      <input name="identifier" placeholder="you.bsky.social" required />
      <label>Or paste profile URL to auto-fill handle</label>
      <input id="profileUrl" placeholder="https://bsky.app/profile/you.bsky.social" />
      <button type="button" onclick="populateHandle()">Populate handle</button>
      <label>App password</label>
      <input name="appPassword" type="password" required />
      <label>PDS service URL</label>
      <input name="service" value="${defaultService}" required />
      <button type="submit">Authenticate</button>
    </form>
    <p>Need an app password? Generate one in Bluesky settings under <code>App passwords</code>.</p>
    <script>
      function populateHandle() {
        const profileInput = document.getElementById("profileUrl");
        const identifierInput = document.querySelector('input[name="identifier"]');
        if (!profileInput || !identifierInput) return;
        const raw = String(profileInput.value || "").trim();
        if (!raw) return;
        const match = raw.match(/bsky\\.app\\/profile\\/([^/?#]+)/i);
        identifierInput.value = match && match[1] ? decodeURIComponent(match[1]) : raw;
      }
    </script>
  </body>
</html>`;
}

function parseForm(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

async function listenForLogin(): Promise<LoginPayload> {
  const code = randomBytes(16).toString("hex");
  const defaultService = "https://bsky.social";
  const timeoutMs = 5 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Invalid request.");
        return;
      }

      if (req.method === "GET" && req.url === "/") {
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end(renderLoginPage(code, defaultService));
        return;
      }

      if (req.method === "POST" && req.url === "/callback") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          const form = parseForm(body);
          if (form.code !== code) {
            res.statusCode = 403;
            res.end("Invalid login code.");
            return;
          }
          if (!form.identifier || !form.appPassword || !form.service) {
            res.statusCode = 400;
            res.end("Missing required fields.");
            return;
          }
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Bluesky authentication received. Return to your terminal.");
          server.close();
          resolve({
            identifier: form.identifier.trim(),
            appPassword: form.appPassword.trim(),
            service: form.service.trim()
          });
        });
        return;
      }

      res.statusCode = 404;
      res.end("Not found.");
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate local callback server."));
        return;
      }

      const url = `http://127.0.0.1:${address.port}/`;
      console.log(chalk.cyan(`Open this URL to authenticate: ${url}`));
      openBrowser(url);
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for Bluesky web authentication."));
    }, timeoutMs);

    server.on("close", () => clearTimeout(timeout));
    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export const command: Command = {
  name: "login",
  description: "Authenticate with Bluesky via local web flow",
  run: async (ctx) => {
    console.log(chalk.cyan("🦋 Starting Bluesky web authentication..."));
    const payload = await listenForLogin();
    const agent = await createAgent(payload.service);
    await agent.login({
      identifier: payload.identifier,
      password: payload.appPassword
    });

    await saveAgentSession(ctx, agent);
    console.log(
      chalk.green(
        `✅ Authenticated as ${agent.session?.handle ?? payload.identifier}`
      )
    );
    console.log(chalk.gray("💾 Session saved to ~/.cli-commander/secrets.json"));
    console.log(
      chalk.cyan(
        "➡️  Next: cct api bluesky followers --limit 10"
      )
    );
  }
};
