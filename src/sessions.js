import { pool } from "./db.js";


/**
 * ------------------------------------------------
 * CREATE OR GET SESSION
 * ------------------------------------------------
 */
export async function getOrCreateSession({
  sessionKey,
  threadId = null,
  rootMessageId = null,
  chatId = null,
  channelId = null,
  objective = null,
  createdBy = null,
  createdByName = null,
}) {

  /**
   * First try to find an existing session.
   */
  const existing = await pool.query(
    `
    SELECT *
    FROM sessions
    WHERE session_key = $1
    LIMIT 1
    `,
    [sessionKey]
  );


  if (existing.rows.length > 0) {

    await pool.query(
      `
      UPDATE sessions
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [existing.rows[0].id]
    );

    return existing.rows[0];
  }


  /**
   * Otherwise create a new session.
   */
  const created = await pool.query(
    `
    INSERT INTO sessions (
      session_key,
      thread_id,
      root_message_id,
      chat_id,
      channel_id,
      objective,
      created_by,
      created_by_name
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8
    )
    RETURNING *
    `,
    [
      sessionKey,
      threadId,
      rootMessageId,
      chatId,
      channelId,
      objective,
      createdBy,
      createdByName,
    ]
  );


  console.log(
    `Created new session: ${created.rows[0].id}`
  );


  return created.rows[0];
}


/**
 * ------------------------------------------------
 * STORE MESSAGE
 * ------------------------------------------------
 */
export async function addSessionMessage({
  sessionId,
  role,
  userId = null,
  userName = null,
  messageText,
}) {

  const result = await pool.query(
    `
    INSERT INTO session_messages (
      session_id,
      role,
      user_id,
      user_name,
      message_text
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [
      sessionId,
      role,
      userId,
      userName,
      messageText,
    ]
  );


  await pool.query(
    `
    UPDATE sessions
    SET updated_at = NOW()
    WHERE id = $1
    `,
    [sessionId]
  );


  return result.rows[0];
}


/**
 * ------------------------------------------------
 * GET CONVERSATION HISTORY
 * ------------------------------------------------
 */
export async function getSessionMessages(
  sessionId,
  limit = 30
) {

  const result = await pool.query(
    `
    SELECT *
    FROM (
      SELECT
        id,
        role,
        user_id,
        user_name,
        message_text,
        created_at

      FROM session_messages

      WHERE session_id = $1

      ORDER BY id DESC

      LIMIT $2
    ) recent_messages

    ORDER BY id ASC
    `,
    [
      sessionId,
      limit,
    ]
  );


  return result.rows;
}


/**
 * ------------------------------------------------
 * SESSION INFO
 * ------------------------------------------------
 */
export async function getSessionByKey(
  sessionKey
) {

  const result = await pool.query(
    `
    SELECT *
    FROM sessions
    WHERE session_key = $1
    LIMIT 1
    `,
    [sessionKey]
  );


  return result.rows[0] || null;
}