import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VietnameseMeetingNotes } from "./gemini";

const slackApiBaseUrl = "https://slack.com/api";

export type SlackBlock = Record<string, unknown>;

export type SlackChannel = {
  id: string;
  name: string;
};

export type SlackOAuthResult = {
  teamId: string;
  accessToken: string;
};

export type DeadlineReminderBlockItem = {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  status: string;
};

export function createSlackOAuthState({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const payload = Buffer.from(
    JSON.stringify({ organizationId, userId }),
    "utf8",
  ).toString("base64url");
  const signature = signStatePayload(payload);
  return `${payload}.${signature}`;
}

export function parseSlackOAuthState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature || signStatePayload(payload) !== signature) {
    throw new Error("Invalid Slack OAuth state.");
  }

  const parsed = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as {
    organizationId?: unknown;
    userId?: unknown;
  };

  if (
    typeof parsed.organizationId !== "string" ||
    typeof parsed.userId !== "string"
  ) {
    throw new Error("Invalid Slack OAuth state.");
  }

  return {
    organizationId: parsed.organizationId,
    userId: parsed.userId,
  };
}

export function buildSlackInstallUrl({
  organizationId,
  userId,
  redirectUri,
}: {
  organizationId: string;
  userId: string;
  redirectUri: string;
}) {
  const params = new URLSearchParams({
    client_id: requireEnv("SLACK_CLIENT_ID"),
    scope: "chat:write,users:read,channels:read",
    redirect_uri: redirectUri,
    state: createSlackOAuthState({ organizationId, userId }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export function encryptSlackToken(token: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSlackToken(encrypted: string) {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid Slack token ciphertext.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function verifySlackRequestSignature({
  body,
  timestamp,
  signature,
  signingSecret = process.env.SLACK_SIGNING_SECRET,
  now = new Date(),
}: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret?: string;
  now?: Date;
}) {
  if (!signingSecret || !timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(now.getTime() / 1000 - timestampSeconds);
  if (ageSeconds > 60 * 5) return false;

  const expected = `v0=${createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex")}`;

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function exchangeSlackOAuthCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<SlackOAuthResult> {
  const clientId = requireEnv("SLACK_CLIENT_ID");
  const clientSecret = requireEnv("SLACK_CLIENT_SECRET");
  const response = await fetch(`${slackApiBaseUrl}/oauth.v2.access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ code, redirect_uri: redirectUri }),
  });
  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string };
  };

  if (!body.ok || !body.access_token || !body.team?.id) {
    throw new Error(`Slack OAuth failed: ${body.error || "missing token"}`);
  }

  return {
    teamId: body.team.id,
    accessToken: body.access_token,
  };
}

export async function listSlackChannels(encryptedAccessToken: string) {
  const token = decryptSlackToken(encryptedAccessToken);
  const response = await fetch(
    `${slackApiBaseUrl}/conversations.list?${new URLSearchParams({
      types: "public_channel",
      exclude_archived: "true",
      limit: "200",
    })}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = (await response.json()) as {
    ok?: boolean;
    error?: string;
    channels?: Array<{ id?: string; name?: string; is_archived?: boolean }>;
  };

  if (!body.ok) {
    throw new Error(`Slack channel list failed: ${body.error || "unknown_error"}`);
  }

  return (body.channels || [])
    .filter((channel): channel is { id: string; name: string } =>
      Boolean(channel.id && channel.name && !channel.is_archived),
    )
    .map((channel) => ({ id: channel.id, name: channel.name }));
}

export async function postSlackMessage({
  encryptedAccessToken,
  channelId,
  text,
  blocks,
}: {
  encryptedAccessToken: string;
  channelId: string;
  text: string;
  blocks: SlackBlock[];
}) {
  const token = decryptSlackToken(encryptedAccessToken);
  const response = await fetch(`${slackApiBaseUrl}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!body.ok) {
    throw new Error(`Slack post failed: ${body.error || "unknown_error"}`);
  }
}

export function buildFollowUpBriefBlocks(
  notes: VietnameseMeetingNotes,
  meetingUrl: string,
): SlackBlock[] {
  return [
    section(`*Follow-up sau cuộc họp: ${escapeMrkdwn(notes.title || "Meeting Notes")}*`),
    section(`*Decisions*\n${formatBullets(notes.decisions)}`),
    section(`*Action items*\n${formatActionBullets(notes.actionItems)}`),
    section(`*Blockers*\n${formatBullets(notes.risksAndBlockers)}`),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open meeting notes" },
          url: meetingUrl,
        },
      ],
    },
  ];
}

export function buildDeadlineReminderBlocks(
  items: DeadlineReminderBlockItem[],
): SlackBlock[] {
  const blocks: SlackBlock[] = [
    section("*Action item deadline reminders*"),
  ];

  for (const item of items) {
    blocks.push(
      section(
        `*${escapeMrkdwn(item.task)}*\nOwner: ${escapeMrkdwn(item.owner)} · Deadline: ${escapeMrkdwn(item.deadline)} · Status: ${escapeMrkdwn(item.status)}`,
      ),
      {
        type: "actions",
        elements: [
          button("✓ Done", `deadline_done:${item.id}`, "primary"),
          button("⏰ Snooze 1 day", `deadline_snooze:${item.id}`),
          button("🚫 Blocked", `deadline_blocked:${item.id}`, "danger"),
        ],
      },
    );
  }

  return blocks;
}

export function parseSlackDeadlineAction(value: string) {
  const [rawAction, actionItemId] = value.split(":");
  if (!actionItemId) throw new Error("Invalid Slack action value.");

  if (rawAction === "deadline_done") {
    return { action: "done" as const, actionItemId };
  }
  if (rawAction === "deadline_snooze") {
    return { action: "snooze" as const, actionItemId };
  }
  if (rawAction === "deadline_blocked") {
    return { action: "blocked" as const, actionItemId };
  }

  throw new Error("Unsupported Slack action value.");
}

function section(text: string): SlackBlock {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text,
    },
  };
}

function button(text: string, value: string, style?: "primary" | "danger") {
  return {
    type: "button",
    text: { type: "plain_text", text },
    value,
    action_id: value.split(":")[0],
    ...(style ? { style } : {}),
  };
}

function formatBullets(items: string[]) {
  const values = items.map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) return "• Chưa xác định";
  return values.map((item) => `• ${escapeMrkdwn(item)}`).join("\n");
}

function formatActionBullets(items: VietnameseMeetingNotes["actionItems"]) {
  if (items.length === 0) return "• Chưa xác định";
  return items
    .map(
      (item) =>
        `• [${escapeMrkdwn(item.priority || "Priority")}] ${escapeMrkdwn(item.task || "Task")} — ${escapeMrkdwn(item.owner || "Unassigned")} — ${escapeMrkdwn(item.deadline || "No deadline")}`,
    )
    .join("\n");
}

function escapeMrkdwn(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getEncryptionKey() {
  const value = requireEnv("SLACK_TOKEN_ENCRYPTION_KEY");
  const raw = Buffer.from(value, "utf8");
  if (raw.length === 32) return raw;

  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through to explicit error
  }

  throw new Error("SLACK_TOKEN_ENCRYPTION_KEY must be 32 bytes or base64-encoded 32 bytes.");
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function signStatePayload(payload: string) {
  return createHmac("sha256", requireEnv("SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}
