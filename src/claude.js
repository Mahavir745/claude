import Anthropic from "@anthropic-ai/sdk";

import {
  SYSTEM_PROMPT,
} from "./prompts.js";


const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});


/**
 * ------------------------------------------------
 * ASK CLAUDE WITH:
 *
 * - conversation history
 * - reply context
 * - web search
 * - session continuity
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


  /**
   * Remove bot mention syntax and internal
   * Cliq mention tokens.
   */
  const cleanMessage =
    cleanUserMessage(message);


  /**
   * Convert PostgreSQL history into
   * Anthropic message format.
   */
  const claudeHistory =
    convertHistoryToClaudeMessages(
      history
    );


  /**
   * Current request content.
   */
  const currentContent = `
USER:
${userName}

CONVERSATION:
${channelName}

ADDITIONAL CLIQ CONTEXT:
${context}

CURRENT REQUEST:
${cleanMessage}
  `.trim();


  /**
   * Build complete Claude conversation.
   */
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
    "CLAUDE REQUEST"
  );

  console.log(
    "======================================"
  );


  console.log(
    "Message count:",
    messages.length
  );


  console.log(
    "Current request:",
    cleanMessage
  );


  /**
   * ------------------------------------------------
   * CLAUDE API CALL
   *
   * Web search is available to Claude,
   * but Claude decides whether it needs it.
   * ------------------------------------------------
   */
  const response =
    await client.messages.create({

      model:
        "claude-sonnet-5",

      max_tokens:
        4000,

      system:
        SYSTEM_PROMPT,

      tools: [
        {
          type:
            "web_search_20250305",

          name:
            "web_search",

          max_uses:
            5,
        },
      ],

      messages,
    });


  /**
   * Log stop reason.
   */
  console.log(
    "Claude stop reason:",
    response.stop_reason
  );


  /**
   * Log all returned content block types.
   *
   * Useful because web-search responses may
   * contain more than plain text blocks.
   */
  console.log(
    "Response content types:",
    response.content.map(
      (block) => block.type
    )
  );


  /**
   * Extract final readable text.
   */
  const text =
    extractClaudeText(
      response.content
    );


  if (!text) {

    console.error(
      "Claude raw response:",
      JSON.stringify(
        response,
        null,
        2
      )
    );


    throw new Error(
      "Claude returned no readable text response."
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

    /**
     * Indicates whether web search appeared
     * in the returned content blocks.
     */
    webSearchUsed:
      detectWebSearchUsage(
        response.content
      ),
  };
}


/**
 * ------------------------------------------------
 * CONVERT SESSION HISTORY
 * ------------------------------------------------
 *
 * PostgreSQL messages:
 *
 * user
 * assistant
 *
 * become Anthropic Messages API messages.
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


    const role =
      item.role === "assistant"
        ? "assistant"
        : "user";


    let content =
      String(item.message_text);


    /**
     * Shared channel sessions may contain
     * multiple human participants.
     *
     * Preserve speaker identity.
     */
    if (
      role === "user" &&
      item.user_name
    ) {

      content =
        `${item.user_name}: ${content}`;
    }


    const previous =
      messages[
        messages.length - 1
      ];


    /**
     * Merge consecutive messages with
     * the same role.
     */
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
 * ------------------------------------------------
 * EXTRACT READABLE CLAUDE TEXT
 * ------------------------------------------------
 */
function extractClaudeText(
  contentBlocks
) {

  if (
    !Array.isArray(contentBlocks)
  ) {
    return "";
  }


  const texts = [];


  for (
    const block of contentBlocks
  ) {

    if (
      block.type === "text" &&
      block.text
    ) {

      texts.push(
        block.text
      );
    }
  }


  return texts
    .join("\n\n")
    .trim();
}


/**
 * ------------------------------------------------
 * DETECT WEB SEARCH USAGE
 * ------------------------------------------------
 */
function detectWebSearchUsage(
  contentBlocks
) {

  if (
    !Array.isArray(contentBlocks)
  ) {
    return false;
  }


  return contentBlocks.some(
    (block) => {

      return (
        block.type ===
          "server_tool_use" ||

        block.type ===
          "web_search_tool_result"
      );
    }
  );
}


/**
 * ------------------------------------------------
 * CLEAN USER MESSAGE
 * ------------------------------------------------
 */
function cleanUserMessage(
  message
) {

  return String(message)

    /**
     * XML-like mention.
     */
    .replace(
      /<@[^>]+>/g,
      " "
    )

    /**
     * Visible mention.
     */
    .replace(
      /@Claude\b/gi,
      " "
    )

    /**
     * Cliq internal bot mention syntax:
     * {@b-123456}
     */
    .replace(
      /\{@b-[^}]+\}/g,
      " "
    )

    /**
     * Plain bot ID.
     */
    .replace(
      /\bb-[0-9]+\b/g,
      " "
    )

    /**
     * Normalize whitespace.
     */
    .replace(
      /\s+/g,
      " "
    )

    .trim();
}