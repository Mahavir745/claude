/**
 * Convert Zoho Cliq message_details
 * into useful text context for Claude.
 *
 * For now this is deliberately flexible because
 * Zoho Cliq payload structures may differ depending
 * on message type and handler.
 */


export function buildCliqContext({
  messageDetails = null,
  attachments = null,
}) {

  const sections = [];


  /**
   * ---------------------------------------------
   * MESSAGE DETAILS
   * ---------------------------------------------
   */
  if (
    messageDetails &&
    typeof messageDetails === "object"
  ) {

    const extractedTexts =
      extractTextValues(messageDetails);


    if (extractedTexts.length > 0) {

      sections.push(`
Relevant message or reply context:

${extractedTexts
  .map((text, index) => `${index + 1}. ${text}`)
  .join("\n")}
      `.trim());

    } else {

      /**
       * Debug fallback
       *
       * Until we know Cliq's exact returned structure,
       * give Claude the JSON.
       */
      sections.push(`
Additional Cliq message metadata:

${JSON.stringify(messageDetails, null, 2)}
      `.trim());
    }
  }


  /**
   * ---------------------------------------------
   * ATTACHMENTS
   * ---------------------------------------------
   */
  if (
    attachments &&
    Array.isArray(attachments) &&
    attachments.length > 0
  ) {

    const attachmentInformation =
      attachments.map((attachment, index) => {

        return `${index + 1}. ${JSON.stringify(attachment)}`;

      }).join("\n");


    sections.push(`
Attachment metadata supplied by Cliq:

${attachmentInformation}

Important:
The existence of attachment metadata does not mean
the actual file contents have been read.
    `.trim());
  }


  /**
   * Nothing available
   */
  if (sections.length === 0) {

    return `
No previous-message, reply, or attachment context was supplied with this request.
    `.trim();
  }


  return sections.join("\n\n");
}


/**
 * ------------------------------------------------
 * RECURSIVELY FIND MESSAGE-LIKE TEXT
 * ------------------------------------------------
 *
 * We avoid collecting every string such as:
 *
 * IDs
 * email addresses
 * names
 * URLs
 * timestamps
 *
 * and prioritize keys commonly associated with
 * message content.
 */
function extractTextValues(object) {

  const results = [];

  const interestingKeys = new Set([
    "text",
    "message",
    "content",
    "original_message",
    "parent_message",
    "reply_message",
    "reply_text",
    "title",
    "description",
  ]);


  function walk(value, keyName = "") {

    if (value === null || value === undefined) {
      return;
    }


    /**
     * String value
     */
    if (typeof value === "string") {

      const cleanValue =
        value.trim();


      if (
        cleanValue.length > 0 &&
        interestingKeys.has(
          keyName.toLowerCase()
        )
      ) {

        results.push(cleanValue);
      }

      return;
    }


    /**
     * Array
     */
    if (Array.isArray(value)) {

      for (const item of value) {
        walk(item, keyName);
      }

      return;
    }


    /**
     * Object
     */
    if (typeof value === "object") {

      for (const [key, childValue] of Object.entries(value)) {

        walk(
          childValue,
          key
        );
      }
    }
  }


  walk(object);


  /**
   * Remove duplicate texts
   */
  return [
    ...new Set(results)
  ];
}