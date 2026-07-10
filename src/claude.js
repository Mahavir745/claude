import Anthropic from
  "@anthropic-ai/sdk";


import {
  SYSTEM_PROMPT,
} from "./prompts.js";


import {
  getSkillsForClaude,
} from "./skills.js";


const client =
  new Anthropic({

    apiKey:
      process.env
        .ANTHROPIC_API_KEY,
  });


/**
 * ------------------------------------------------
 * ASK CLAUDE
 * ------------------------------------------------
 */
export async function askClaude({

  message,

  history = [],

  userName =
    "Team member",

  channelName =
    "Unknown conversation",

  context = "",

  userCountry = null,

  userTimezone = null,

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
   * Clean Cliq command/message.
   */
  const cleanMessage =
    cleanUserMessage(
      message
    );


  /**
   * Convert stored PostgreSQL
   * history to Claude format.
   */
  const claudeHistory =
    convertHistoryToClaudeMessages(
      history
    );


  /**
   * Automatically fetch current
   * custom Skills.
   */
  let skills = [];


  try {

    skills =
      await getSkillsForClaude();


    console.log(
      `Attaching ${skills.length} custom Skill(s).`
    );

  } catch (error) {

    /**
     * Skill API failure should not
     * prevent normal Claude usage.
     */
    console.error(
      "Unable to load Skills:",
      error.message
    );


    skills = [];
  }


  const currentContent = `
USER:
${userName}

CONVERSATION:
${channelName}

ADDITIONAL CLIQ CONTEXT:
${context}

CURRENT USER REQUEST:
${cleanMessage}
  `.trim();


  const messages = [

    ...claudeHistory,

    {
      role: "user",
      content: currentContent,
    },
  ];


  /**
   * Web search tool.
   */
  const webSearchTool =
    buildWebSearchTool({

      userCountry,

      userTimezone,
    });


  /**
   * Tools available to Claude.
   */
  const tools = [

    /**
     * Required for Agent Skills.
     */
    {
      type:
        "code_execution_20260521",

      name:
        "code_execution",
    },


    /**
     * Current public information.
     */
    webSearchTool,
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
    "History message count:",
    claudeHistory.length
  );


  console.log(
    "Current request:",
    cleanMessage
  );


  console.log(
    "Attached Skills:",
    skills.map(
      (skill) =>
        skill.skill_id
    )
  );


  /**
   * ----------------------------------------------
   * REQUEST PARAMETERS
   * ----------------------------------------------
   */
  const requestParams = {

    model:
      "claude-sonnet-5",

    max_tokens:
      4000,

    betas: [
      "skills-2025-10-02",
    ],

    system:
      SYSTEM_PROMPT,

    messages,

    tools,
  };


  /**
   * Only include container when
   * custom Skills actually exist.
   */
  if (
    skills.length > 0
  ) {

    requestParams.container = {

      skills,
    };
  }


  /**
   * ----------------------------------------------
   * CLAUDE BETA MESSAGES API
   * ----------------------------------------------
   */
  const response =
    await client.beta.messages.create(
      requestParams
    );


  console.log(
    "Claude stop reason:",
    response.stop_reason
  );


  console.log(
    "Content block types:",
    response.content.map(
      (block) =>
        block.type
    )
  );


  /**
   * Extract text.
   */
  const answerText =
    extractClaudeText(
      response.content
    );


  /**
   * Extract search sources.
   */
  const sources =
    extractWebSources(
      response.content
    );


  const webSearchUsed =
    detectWebSearchUsage(

      response.content,

      response.usage
    );


  const skillExecutionUsed =
    detectSkillExecution(
      response.content
    );


  let finalText =
    answerText;


  /**
   * Add source list for Cliq.
   */
  if (
    sources.length > 0
  ) {

    const sourceText =
      sources

        .slice(0, 5)

        .map(
          (
            source,
            index
          ) => {

            return (
              `${index + 1}. ${source.title}\n${source.url}`
            );
          }
        )

        .join("\n\n");


    finalText +=
      `\n\nSources:\n${sourceText}`;
  }


  if (
    !finalText ||
    !finalText.trim()
  ) {

    console.error(
      "Claude raw response:",
      JSON.stringify(
        response,
        null,
        2
      )
    );


    throw new Error(
      "Claude returned no readable response."
    );
  }


  return {

    text:
      sanitizeForCliq(
        finalText.trim()
      ),

    usage:
      response.usage,

    model:
      response.model,

    stopReason:
      response.stop_reason,

    webSearchUsed,

    skillExecutionUsed,

    attachedSkills:
      skills.map(
        (skill) =>
          skill.skill_id
      ),

    sources,
  };
}


/**
 * ------------------------------------------------
 * WEB SEARCH TOOL
 * ------------------------------------------------
 */
function buildWebSearchTool({

  userCountry,

  userTimezone,

}) {

  const tool = {

    type:
      "web_search_20250305",

    name:
      "web_search",

    max_uses:
      5,
  };


  const country =
    normalizeCountryCode(
      userCountry
    );


  if (
    country ||
    userTimezone
  ) {

    tool.user_location = {

      type:
        "approximate",
    };


    if (country) {

      tool.user_location.country =
        country;
    }


    if (
      userTimezone &&
      String(
        userTimezone
      ).trim()
    ) {

      tool.user_location.timezone =
        String(
          userTimezone
        ).trim();
    }
  }


  return tool;
}


/**
 * ------------------------------------------------
 * DATABASE HISTORY → CLAUDE HISTORY
 * ------------------------------------------------
 */
function convertHistoryToClaudeMessages(
  history
) {

  const messages = [];


  for (
    const item of history
  ) {

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
      String(
        item.message_text
      );


    /**
     * Preserve human speaker name.
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
     * Merge consecutive roles.
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
 * TEXT EXTRACTION
 * ------------------------------------------------
 */
function extractClaudeText(
  contentBlocks
) {

  if (
    !Array.isArray(
      contentBlocks
    )
  ) {

    return "";
  }


  return contentBlocks

    .filter(
      (block) =>
        block.type === "text" &&
        block.text
    )

    .map(
      (block) =>
        block.text
    )

    .join("\n\n")

    .trim();
}


/**
 * ------------------------------------------------
 * WEB SEARCH DETECTION
 * ------------------------------------------------
 */
function detectWebSearchUsage(

  contentBlocks,

  usage

) {

  if (
    usage
      ?.server_tool_use
      ?.web_search_requests > 0
  ) {

    return true;
  }


  if (
    !Array.isArray(
      contentBlocks
    )
  ) {

    return false;
  }


  return contentBlocks.some(
    (block) =>

      block.type ===
        "server_tool_use" ||

      block.type ===
        "web_search_tool_result"
  );
}


/**
 * ------------------------------------------------
 * SKILL / CODE EXECUTION DETECTION
 * ------------------------------------------------
 */
function detectSkillExecution(
  contentBlocks
) {

  if (
    !Array.isArray(
      contentBlocks
    )
  ) {

    return false;
  }


  return contentBlocks.some(
    (block) => {

      const type =
        block.type || "";


      return (
        type.includes(
          "code_execution"
        ) ||

        type.includes(
          "bash_code_execution"
        )
      );
    }
  );
}


/**
 * ------------------------------------------------
 * SEARCH SOURCES
 * ------------------------------------------------
 */
function extractWebSources(
  contentBlocks
) {

  const sources = [];


  function walk(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return;
    }


    if (
      Array.isArray(value)
    ) {

      for (
        const item of value
      ) {

        walk(item);
      }


      return;
    }


    if (
      typeof value !== "object"
    ) {

      return;
    }


    if (
      value.type ===
        "web_search_result" &&
      value.url
    ) {

      sources.push({

        title:
          value.title ||
          value.url,

        url:
          value.url,
      });
    }


    for (
      const child of
        Object.values(value)
    ) {

      walk(child);
    }
  }


  walk(contentBlocks);


  const seen =
    new Set();


  return sources.filter(
    (source) => {

      if (
        seen.has(source.url)
      ) {

        return false;
      }


      seen.add(
        source.url
      );


      return true;
    }
  );
}


/**
 * ------------------------------------------------
 * CLEAN CLIQ INPUT
 * ------------------------------------------------
 */
function cleanUserMessage(
  message
) {

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
      /\{@b-[^}]+\}/g,
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


/**
 * ------------------------------------------------
 * CLIQ OUTPUT SANITIZER
 * ------------------------------------------------
 *
 * Prevent ~ from being interpreted
 * as Cliq strikethrough syntax.
 */
function sanitizeForCliq(
  text
) {

  return String(text)

    .replace(
      /~(?=\d)/g,
      "approximately "
    )

    .trim();
}


/**
 * ------------------------------------------------
 * COUNTRY NORMALIZATION
 * ------------------------------------------------
 */
function normalizeCountryCode(
  country
) {

  if (!country) {

    return null;
  }


  const value =
    String(country)

      .trim()

      .toUpperCase();


  if (
    /^[A-Z]{2}$/.test(value)
  ) {

    return value;
  }


  return null;
}