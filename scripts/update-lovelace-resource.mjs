#!/usr/bin/env node
import WebSocket from "ws";

const [haUrl, token, resourceUrl, matchToken] = process.argv.slice(2);

if (!haUrl || !token || !resourceUrl || !matchToken) {
  console.error(
    "usage: update-lovelace-resource.mjs <ha-url> <token> <resource-url> <match-token>",
  );
  process.exit(2);
}

const wsUrl = `${haUrl.replace(/^http/, "ws").replace(/\/+$/, "")}/api/websocket`;

let nextId = 1;
let phase = "list";
let resourceId = null;
let settled = false;
const ws = new WebSocket(wsUrl);

const timer = setTimeout(() => fail("timed out waiting for Home Assistant"), 15000);

function send(message) {
  ws.send(JSON.stringify({ id: nextId++, ...message }));
}

function fail(message) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  console.error(`ERROR: ${message}`);
  ws.terminate();
  process.exit(1);
}

function finish() {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  console.log(`   Lovelace resource verified: ${resourceUrl}`);
  ws.close();
  process.exit(0);
}

function failIfNotOk(message, result) {
  if (!result.success) {
    fail(`${message}: ${JSON.stringify(result.error ?? {})}`);
  }
}

function handleResult(result) {
  if (phase === "list") {
    failIfNotOk("failed to list lovelace resources", result);
    const existing = (result.result ?? []).find(
      (item) => typeof item.url === "string" && item.url.includes(matchToken),
    );

    if (existing) {
      resourceId = existing.id;
      console.log(`   Updating existing resource ${existing.id}`);
      phase = "update";
      send({
        type: "lovelace/resources/update",
        resource_id: resourceId,
        res_type: "module",
        url: resourceUrl,
      });
    } else {
      console.log("   No existing resource found, creating");
      phase = "create";
      send({ type: "lovelace/resources/create", res_type: "module", url: resourceUrl });
    }
    return;
  }

  if (phase === "update") {
    failIfNotOk("failed to update lovelace resource", result);
    phase = "verify";
    send({ type: "lovelace/resources" });
    return;
  }

  if (phase === "create") {
    failIfNotOk("failed to create lovelace resource", result);
    resourceId = result.result?.id ?? null;
    phase = "verify";
    send({ type: "lovelace/resources" });
    return;
  }

  if (phase === "verify") {
    failIfNotOk("failed to verify lovelace resources", result);
    const registered = (result.result ?? []).find(
      (item) => item.id === resourceId || item.url === resourceUrl,
    );

    if (!registered) {
      fail(`resource is not registered after update (expected ${resourceUrl})`);
    }
    if (registered.url !== resourceUrl) {
      fail(`registered URL is ${registered.url}, expected ${resourceUrl}`);
    }
    finish();
  }
}

ws.on("message", (raw) => {
  const message = JSON.parse(raw.toString());

  switch (message.type) {
    case "auth_required":
      ws.send(JSON.stringify({ type: "auth", access_token: token }));
      break;
    case "auth_ok":
      send({ type: "lovelace/resources" });
      break;
    case "auth_invalid":
      fail(`authentication failed: ${message.message ?? "invalid access token"}`);
      break;
    case "result":
      handleResult(message);
      break;
    default:
      break;
  }
});

ws.on("error", (error) => fail(`websocket error: ${error.message}`));
ws.on("close", () => fail("websocket closed before the resource update completed"));
