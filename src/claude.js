import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompts.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askClaude({
  message,
  userName = "Team member",
  channelName = "Unknown channel",
}) {
  if (!message || !message.trim()) {
    throw new Error("Message is required.");
  }

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,

    system: SYSTEM_PROMPT,

    messages: [
      {
        role: "user",
        content: `
User: ${userName}
Channel: ${channelName}

Task:
${message}
        `.trim(),
      },
    ],
  });

  const textBlocks = response.content.filter(
    (block) => block.type === "text"
  );

  const text = textBlocks
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned no text response.");
  }

  return {
    text,
    usage: response.usage,
    model: response.model,
    stopReason: response.stop_reason,
  };
}