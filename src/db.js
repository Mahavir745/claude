import pg from "pg";


const {
  Pool,
} = pg;


if (
  !process.env.DATABASE_URL
) {

  throw new Error(
    "DATABASE_URL environment variable is missing."
  );
}


export const pool =
  new Pool({

    connectionString:
      process.env.DATABASE_URL,

    max:
      5,

    idleTimeoutMillis:
      30000,

    connectionTimeoutMillis:
      10000,
  });


pool.on(
  "error",

  (error) => {

    console.error(
      "Unexpected PostgreSQL pool error:",
      error
    );
  }
);


/**
 * Test connection.
 */
export async function testDatabaseConnection() {

  const result =
    await pool.query(
      "SELECT NOW() AS current_time"
    );


  console.log(
    "PostgreSQL connected:",
    result.rows[0].current_time
  );


  return result.rows[0];
}


/**
 * Initialize tables.
 */
export async function initializeDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (

      id BIGSERIAL PRIMARY KEY,

      session_key TEXT UNIQUE NOT NULL,

      thread_id TEXT,

      root_message_id TEXT,

      chat_id TEXT,

      channel_id TEXT,

      objective TEXT,

      status TEXT NOT NULL DEFAULT 'active',

      created_by TEXT,

      created_by_name TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_messages (

      id BIGSERIAL PRIMARY KEY,

      session_id BIGINT NOT NULL
        REFERENCES sessions(id)
        ON DELETE CASCADE,

      role TEXT NOT NULL,

      user_id TEXT,

      user_name TEXT,

      message_text TEXT NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
      idx_session_messages_session_id

    ON session_messages(session_id);
  `);


  console.log(
    "Database tables initialized successfully."
  );
}