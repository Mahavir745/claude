import Anthropic from "@anthropic-ai/sdk";

import { SYSTEM_PROMPT } from "./prompts.js";
import { buildCliqContext } from "./context.js";


const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});


export async function askClaude({
  message,
  userName = "Team member",
  channelName = "Unknown conversation",
  messageDetails = null,
  attachments = null,
}) {
  if (!message || !String(message).trim()) {
    throw new Error("Message is required.");
  }


  /**
   * Remove Cliq mention syntax before sending
   * the user's actual instruction to Claude.
   */
  const cleanMessage = cleanUserMessage(message);


  const context = buildCliqContext({
    messageDetails,
    attachments,
  });


  const prompt = `
You are responding inside Zoho Cliq.

USER:
${userName}

CONVERSATION:
${channelName}

CONTEXT:
${context}

CURRENT USER REQUEST:
${cleanMessage}

INTERPRETATION RULES:

1. Answer the user's actual request directly.

2. When a replied-to message is provided and the user says:
   - this
   - that
   - it
   - above
   - previous message
   - what is this
   - explain this

   assume the user is referring to the replied-to message.

3. Do not interpret bot mentions, mention IDs, user IDs,
   or internal Cliq identifiers as the subject of the question.

4. The bot mention is only a way of invoking you.
   It is not normally part of the user's semantic question.

5. Use the replied-to message as primary context when present.

6. Do not claim access to systems, files, tools, databases,
   or external links unless their actual contents were supplied.

7. Give a useful direct answer instead of asking for context
   when sufficient reply context is already available.
`.trim();


  console.log("\n======================================");
  console.log("PROMPT SENT TO CLAUDE");
  console.log("======================================");

  console.log(prompt);


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


  const text = response.content
    .filter((block) => block.type === "text")
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


/**
 * Remove common Zoho Cliq mention representations.
 */
function cleanUserMessage(message) {
  return String(message)

    // XML-style mention representations
    .replace(/<@[^>]+>/g, " ")

    // Visible mention
    .replace(/@Claude\b/gi, " ")

    // Possible bot/user internal token patterns
    .replace(/\bb-[0-9]+\b/g, " ")

    // Clean spaces
    .replace(/\s+/g, " ")

    .trim();
}