import Anthropic from "@anthropic-ai/sdk";

import {
  SYSTEM_PROMPT,
} from "./prompts.js";


const client = new Anthropic({
  apiKey:
    process.env.ANTHROPIC_API_KEY,
});


/**
 * ------------------------------------------------
 * ASK CLAUDE WITH SESSION HISTORY
 * ------------------------------------------------
 */
export async function askClaude({
  message,
  history = [],
  userName = "Team member",
  channelName = "Unknown conversation",
  context = "",
}) {

  if (
    !message ||
    !String(message).trim()
  ) {
    throw new Error(
      "Message is required."
    );
  }


  const cleanMessage =
    cleanUserMessage(message);


  /**
   * Convert stored DB messages into
   * Anthropic message format.
   */
  const claudeHistory =
    convertHistoryToClaudeMessages(history);


  /**
   * Current user request.
   */
  const currentContent = `
USER:
${userName}

CONVERSATION:
${channelName}

ADDITIONAL CONTEXT:
${context}

CURRENT REQUEST:
${cleanMessage}
  `.trim();


  const messages = [
    ...claudeHistory,

    {
      role: "user",
      content: currentContent,
    },
  ];


  console.log(
    "\n======================================"
  );

  console.log(
    "CLAUDE SESSION MESSAGE COUNT:",
    messages.length
  );

  console.log(
    "======================================"
  );


  const response =
    await client.messages.create({

      model:
        "claude-sonnet-5",

      max_tokens:
        4000,

      system:
        SYSTEM_PROMPT,

      messages,
    });


  const text =
    response.content

      .filter(
        (block) =>
          block.type === "text"
      )

      .map(
        (block) =>
          block.text
      )

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


/**
 * ------------------------------------------------
 * CONVERT DATABASE HISTORY
 * ------------------------------------------------
 */
function convertHistoryToClaudeMessages(
  history
) {

  const messages = [];


  for (const item of history) {

    if (
      !item.message_text ||
      !item.role
    ) {
      continue;
    }


    /**
     * Anthropic expects user/assistant roles.
     */
    const role =
      item.role === "assistant"
        ? "assistant"
        : "user";


    let content =
      item.message_text;


    /**
     * Preserve teammate identity in shared sessions.
     */
    if (
      role === "user" &&
      item.user_name
    ) {

      content =
        `${item.user_name}: ${content}`;
    }


    /**
     * Anthropic requires alternating conversational
     * structure. Merge consecutive messages with
     * the same role.
     */
    const previous =
      messages[messages.length - 1];


    if (
      previous &&
      previous.role === role
    ) {

      previous.content +=
        `\n\n${content}`;

    } else {

      messages.push({
        role,
        content,
      });
    }
  }


  return messages;
}


/**
 * Remove Cliq mention syntax.
 */
function cleanUserMessage(message) {

  return String(message)

    .replace(
      /<@[^>]+>/g,
      " "
    )

    .replace(
      /@Claude\b/gi,
      " "
    )

    .replace(
      /\bb-[0-9]+\b/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();
}