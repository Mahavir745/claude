/**
 * Build context from flat Cliq payload.
 */
export function buildCliqContext({

  replyText = null,

  replySenderName = null,

  attachments = null,

}) {

  const sections = [];


  /**
   * Reply context.
   */
  if (
    replyText &&
    String(replyText).trim()
  ) {

    const sender =
      replySenderName
        ? `Sender: ${replySenderName}\n`
        : "";


    sections.push(
      `
REPLIED-TO MESSAGE:

${sender}${String(replyText).trim()}

The current request refers to the message above when the user says
"this", "that", "it", "above", or similar wording.
      `.trim()
    );
  }


  /**
   * Attachment metadata.
   */
  if (
    Array.isArray(attachments) &&
    attachments.length > 0
  ) {

    sections.push(
      `
ATTACHMENT METADATA:

${JSON.stringify(
  attachments,
  null,
  2
)}

Do not claim to have read attachment contents merely because metadata exists.
      `.trim()
    );
  }


  if (
    sections.length === 0
  ) {

    return (
      "No separate reply context or attachment content was supplied."
    );
  }


  return sections.join(
    "\n\n"
  );
}


/**
 * Build session key.
 */
export function buildSessionKey({

  threadId = null,

  chatId = null,

  channelId = null,

  userId = null,

}) {

  if (
    threadId &&
    String(threadId).trim()
  ) {

    return (
      `thread:${String(threadId).trim()}`
    );
  }


  if (
    chatId &&
    String(chatId).trim()
  ) {

    return (
      `chat:${String(chatId).trim()}`
    );
  }


  if (
    channelId &&
    String(channelId).trim()
  ) {

    return (
      `channel:${String(channelId).trim()}`
    );
  }


  if (
    userId &&
    String(userId).trim()
  ) {

    return (
      `user:${String(userId).trim()}`
    );
  }


  throw new Error(
    "Unable to determine conversation session key."
  );
}