import Anthropic from "@anthropic-ai/sdk";

import { SYSTEM_PROMPT } from "./prompts.js";

import {
  buildCliqContext,
} from "./context.js";


const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});


/**
 * Ask Claude
 */
export async function askClaude({
  message,
  userName = "Team member",
  channelName = "Unknown conversation",
  messageDetails = null,
  attachments = null,
}) {

  if (!message || !message.trim()) {
    throw new Error(
      "Message is required."
    );
  }


  /**
   * Build useful Cliq context
   */
  const context = buildCliqContext({
    messageDetails,
    attachments,
  });


  /**
   * Construct user prompt
   */
  const prompt = `
You are responding inside Zoho Cliq.

User:
${userName}

Conversation:
${channelName}

${context}

Current user request:
${message}

Instructions:

- Answer the current request directly.
- Use previous/replied-message context when it is relevant.
- When the user says things like "this", "that", "above", or "previous message",
  inspect the supplied Cliq context before saying context is missing.
- Do not say that no context was provided when a replied message is available.
- Do not claim you opened files, links, systems, databases, or applications
  unless their actual contents were provided to you.
- If context is incomplete, explain exactly what information is missing.
`.trim();


  console.log("\n======================================");
  console.log("PROMPT SENT TO CLAUDE");
  console.log("======================================");
  console.log(prompt);


  /**
   * Claude API call
   */
  const response = await client.messages.create({
    model: "claude-sonnet-5",

    max_tokens: 4000,

    system: SYSTEM_PROMPT,

    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });


  /**
   * Extract text response
   */
  const textBlocks = response.content.filter(
    (block) => block.type === "text"
  );


  const text = textBlocks
    .map((block) => block.text)
    .join("\n")
    .trim();


  if (!text) {
    throw new Error(
      "Claude returned no text response."
    );
  }


  return {
    text,

    usage:
      response.usage,

    model:
      response.model,

    stopReason:
      response.stop_reason,
  };
}