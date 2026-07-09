/**
 * Build clean context from Zoho Cliq message_details.
 */

export function buildCliqContext({
  messageDetails = null,
  attachments = null,
}) {
  const sections = [];

  const repliedMessage = extractReplyText(messageDetails);

  if (repliedMessage) {
    sections.push(`
REPLIED-TO MESSAGE:

${repliedMessage}

IMPORTANT:
The user's current message is a reply to the message above.
When the user says "this", "that", "it", "above", or similar references,
assume they are referring to the replied-to message unless the wording
clearly indicates otherwise.
    `.trim());
  }

  if (
    attachments &&
    Array.isArray(attachments) &&
    attachments.length > 0
  ) {
    sections.push(`
ATTACHMENT METADATA:

${JSON.stringify(attachments, null, 2)}

The metadata above does not mean the actual attachment content has been read.
    `.trim());
  }

  if (sections.length === 0) {
    return `
No replied-message context or attachment content was provided.
    `.trim();
  }

  return sections.join("\n\n");
}


/**
 * Find the actual replied-to message.
 */
function extractReplyText(messageDetails) {
  if (!messageDetails || typeof messageDetails !== "object") {
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
      value.trim().length > 0
    ) {
      return cleanText(value);
    }
  }

  // Recursive fallback.
  return findBestMessageText(messageDetails);
}


function findBestMessageText(value) {
  const candidates = [];

  function walk(current, key = "") {
    if (current === null || current === undefined) {
      return;
    }

    if (typeof current === "string") {
      const cleaned = cleanText(current);

      const messageKeys = new Set([
        "text",
        "message",
        "content",
        "reply_text",
        "parent_message",
        "original_message",
      ]);

      if (
        messageKeys.has(key.toLowerCase()) &&
        cleaned.length > 10 &&
        !looksLikeId(cleaned)
      ) {
        candidates.push(cleaned);
      }

      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => walk(item, key));
      return;
    }

    if (typeof current === "object") {
      Object.entries(current).forEach(([childKey, childValue]) => {
        walk(childValue, childKey);
      });
    }
  }

  walk(value);

  if (candidates.length === 0) {
    return null;
  }

  // Prefer meaningful longer message content.
  candidates.sort((a, b) => b.length - a.length);

  return candidates[0];
}


function cleanText(text) {
  return String(text)
    .replace(/<@[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function looksLikeId(text) {
  return /^[a-zA-Z0-9_\-.:]+$/.test(text) && text.length < 100;
}