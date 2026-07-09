/**
 * Build useful context from Zoho Cliq data.
 */
export function buildCliqContext({
  messageDetails = null,
  attachments = null,
}) {
  const sections = [];

  const repliedMessage = extractReplyText(messageDetails);

  if (repliedMessage) {
    sections.push(
      `
REPLIED-TO MESSAGE:

${repliedMessage}

The user's current message is a reply to the message above.

When the user says:
"this",
"that",
"it",
"above",
or similar wording,

the replied-to message is normally the primary reference.
      `.trim()
    );
  }

  if (
    Array.isArray(attachments) &&
    attachments.length > 0
  ) {
    sections.push(
      `
ATTACHMENT METADATA:

${JSON.stringify(attachments, null, 2)}

Important:
Attachment metadata does not mean the actual file contents were read.
      `.trim()
    );
  }

  if (sections.length === 0) {
    return `
No separate replied-message or attachment context was supplied.
    `.trim();
  }

  return sections.join("\n\n");
}


/**
 * Extract thread/message identifiers from Cliq payload.
 */
export function extractConversationIdentifiers({
  threadId = null,
  rootMessageId = null,
  messageId = null,
  messageDetails = null,
}) {
  const detectedThreadId =
    threadId ||
    findValueByKeys(messageDetails, [
      "thread_id",
      "threadId",
    ]);

  const detectedRootMessageId =
    rootMessageId ||
    findValueByKeys(messageDetails, [
      "root_message_id",
      "rootMessageId",
      "parent_message_id",
      "parentMessageId",
      "reply_to_message_id",
    ]);

  const detectedMessageId =
    messageId ||
    findValueByKeys(messageDetails, [
      "message_id",
      "messageId",
      "id",
    ]);

  return {
    threadId: cleanIdentifier(detectedThreadId),

    rootMessageId: cleanIdentifier(
      detectedRootMessageId
    ),

    messageId: cleanIdentifier(
      detectedMessageId
    ),
  };
}


/**
 * Build a persistent session key.
 */
export function buildSessionKey({
  threadId,
  rootMessageId,
  messageId,
  chatId,
}) {
  if (threadId) {
    return `thread:${threadId}`;
  }

  if (rootMessageId) {
    return `thread:${rootMessageId}`;
  }

  if (messageId) {
    return `message:${messageId}`;
  }

  if (chatId) {
    return `chat:${chatId}`;
  }

  throw new Error(
    "Unable to determine conversation session key."
  );
}


/**
 * Extract replied-message text.
 */
function extractReplyText(messageDetails) {
  if (
    !messageDetails ||
    typeof messageDetails !== "object"
  ) {
    return null;
  }

  const possiblePaths = [
    messageDetails?.reply?.text,
    messageDetails?.reply?.message,
    messageDetails?.reply?.content,

    messageDetails?.parent?.text,
    messageDetails?.parent?.message,
    messageDetails?.parent?.content,

    messageDetails?.original_message?.text,
    messageDetails?.original_message?.message,

    messageDetails?.reply_message?.text,
    messageDetails?.reply_message?.message,

    messageDetails?.parent_message?.text,
    messageDetails?.parent_message?.message,

    messageDetails?.text,
    messageDetails?.message,
    messageDetails?.content,
  ];

  for (const value of possiblePaths) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return cleanText(value);
    }
  }

  return findBestMessageText(messageDetails);
}


/**
 * Recursively search for useful message text.
 */
function findBestMessageText(value) {
  const candidates = [];

  const interestingKeys = new Set([
    "text",
    "message",
    "content",
    "reply_text",
    "parent_message",
    "original_message",
  ]);

  function walk(current, key = "") {
    if (
      current === null ||
      current === undefined
    ) {
      return;
    }

    if (typeof current === "string") {
      const cleaned = cleanText(current);

      if (
        interestingKeys.has(
          key.toLowerCase()
        ) &&
        cleaned.length > 10 &&
        !looksLikeId(cleaned)
      ) {
        candidates.push(cleaned);
      }

      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => {
        walk(item, key);
      });

      return;
    }

    if (typeof current === "object") {
      Object.entries(current).forEach(
        ([childKey, childValue]) => {
          walk(childValue, childKey);
        }
      );
    }
  }

  walk(value);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(
    (a, b) => b.length - a.length
  );

  return candidates[0];
}


/**
 * Recursively find a value by possible key names.
 */
function findValueByKeys(object, keys) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return null;
  }

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  for (const value of Object.values(object)) {
    if (
      value &&
      typeof value === "object"
    ) {
      const found = findValueByKeys(
        value,
        keys
      );

      if (found !== null) {
        return found;
      }
    }
  }

  return null;
}


/**
 * Clean visible message text.
 */
function cleanText(text) {
  return String(text)
    .replace(/<@[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * Convert ID-like values to string.
 */
function cleanIdentifier(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  return null;
}


/**
 * Check whether a string looks like an internal ID.
 */
function looksLikeId(text) {
  return (
    /^[a-zA-Z0-9_\-.:]+$/.test(text) &&
    text.length < 100
  );
}