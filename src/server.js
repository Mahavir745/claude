import "dotenv/config";


import express from
  "express";


import cors from
  "cors";


import {
  askClaude,
} from "./claude.js";


import {
  testDatabaseConnection,

  initializeDatabase,
} from "./db.js";


import {

  getOrCreateSession,

  addSessionMessage,

  getSessionMessages,

} from "./sessions.js";


import {

  buildCliqContext,

  buildSessionKey,

} from "./context.js";


import {

  getAvailableSkills,

  refreshSkillCache,

  getSkillCacheStatus,

} from "./skills.js";


const app =
  express();


app.use(
  cors()
);


app.use(
  express.json({

    limit:
      "5mb",
  })
);


/**
 * JSON parse error handler.
 */
app.use(
  (
    error,

    req,

    res,

    next
  ) => {

    if (
      error instanceof SyntaxError &&
      "body" in error
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "Invalid JSON body",

          details:
            error.message,
        });
    }


    next(error);
  }
);


/**
 * ------------------------------------------------
 * HEALTH
 * ------------------------------------------------
 */
app.get(

  "/health",

  (req, res) => {

    return res.json({

      success:
        true,

      service:
        "cliq-claude-agent",

      status:
        "running",

      timestamp:
        new Date().toISOString(),
    });
  }
);


/**
 * ------------------------------------------------
 * DB HEALTH
 * ------------------------------------------------
 */
app.get(

  "/health/db",

  async (
    req,
    res
  ) => {

    try {

      const db =
        await testDatabaseConnection();


      return res.json({

        success:
          true,

        database:
          "connected",

        database_time:
          db.current_time,
      });

    } catch (error) {

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            error.message,
        });
    }
  }
);


/**
 * ------------------------------------------------
 * VIEW CURRENT SKILLS
 * ------------------------------------------------
 */
app.get(

  "/api/skills",

  async (
    req,
    res
  ) => {

    try {

      const skills =
        await getAvailableSkills();


      return res.json({

        success:
          true,

        count:
          skills.length,

        skills,
      });

    } catch (error) {

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            error.message,
        });
    }
  }
);


/**
 * ------------------------------------------------
 * FORCE SKILL REFRESH
 * ------------------------------------------------
 */
app.post(

  "/api/skills/refresh",

  async (
    req,
    res
  ) => {

    try {

      const skills =
        await refreshSkillCache();


      return res.json({

        success:
          true,

        message:
          "Skill cache refreshed.",

        count:
          skills.length,

        skills,
      });

    } catch (error) {

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            error.message,
        });
    }
  }
);


/**
 * ------------------------------------------------
 * SKILL CACHE STATUS
 * ------------------------------------------------
 */
app.get(

  "/api/skills/cache",

  (
    req,
    res
  ) => {

    return res.json({

      success:
        true,

      cache:
        getSkillCacheStatus(),
    });
  }
);


/**
 * ------------------------------------------------
 * CLIQ ASK ENDPOINT
 * ------------------------------------------------
 */
app.post(

  "/api/cliq/mention",

  async (
    req,
    res
  ) => {

    try {

      const {

        message,

        user_name,

        user_id,

        user_email,

        user_country,

        user_timezone,

        chat_id,

        channel_id,

        channel_name,

        chat_type,

        chat_unique_name,

        message_id,

        thread_id,

        reply_text,

        reply_message_id,

        reply_sender_name,

        attachments,

      } = req.body;


      if (
        !message ||
        !String(message).trim()
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "message is required",
          });
      }


      console.log(
        "\n======================================"
      );

      console.log(
        "NEW CLIQ REQUEST"
      );

      console.log(
        "======================================"
      );


      console.log(
        "Message:",
        message
      );


      /**
       * Session key.
       */
      const sessionKey =
        buildSessionKey({

          threadId:
            thread_id ||
            null,

          chatId:
            chat_id ||
            null,

          channelId:
            channel_id ||
            null,

          userId:
            user_id ||
            user_email ||
            null,
        });


      console.log(
        "Session Key:",
        sessionKey
      );


      /**
       * Get/create session.
       */
      const session =
        await getOrCreateSession({

          sessionKey,

          threadId:
            thread_id ||
            null,

          rootMessageId:
            reply_message_id ||
            null,

          chatId:
            chat_id ||
            null,

          channelId:
            channel_id ||
            null,

          objective:
            String(message),

          createdBy:
            user_id ||
            user_email ||
            null,

          createdByName:
            user_name ||
            null,
        });


      /**
       * Recent history only.
       */
      const history =
        await getSessionMessages(

          session.id,

          12
        );


      /**
       * Reply context.
       */
      const context =
        buildCliqContext({

          replyText:
            reply_text ||
            null,

          replySenderName:
            reply_sender_name ||
            null,

          attachments:
            attachments ||
            null,
        });


      /**
       * Ask Claude.
       */
      const result =
        await askClaude({

          message:
            String(message),

          history,

          userName:
            user_name ||
            "Team member",

          channelName:
            channel_name ||
            chat_unique_name ||
            channel_id ||
            chat_id ||
            "Unknown conversation",

          context,

          userCountry:
            user_country ||
            null,

          userTimezone:
            user_timezone ||
            null,
        });


      /**
       * Save user message.
       */
      await addSessionMessage({

        sessionId:
          session.id,

        role:
          "user",

        userId:
          user_id ||
          null,

        userName:
          user_name ||
          null,

        messageText:
          String(message),
      });


      /**
       * Save Claude response.
       */
      await addSessionMessage({

        sessionId:
          session.id,

        role:
          "assistant",

        userName:
          "Claude",

        messageText:
          result.text,
      });


      return res.json({

        success:
          true,

        response: {

          text:
            result.text,
        },

        session: {

          id:
            session.id,

          key:
            session.session_key,

          status:
            session.status,
        },

        metadata: {

          model:
            result.model,

          stop_reason:
            result.stopReason,

          web_search_used:
            result.webSearchUsed,

          skill_execution_used:
            result.skillExecutionUsed,

          attached_skills:
            result.attachedSkills,

          sources:
            result.sources,

          usage:
            result.usage,
        },
      });


    } catch (error) {

      console.error(
        "Request error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

          error:
            "Claude request failed.",

          details:
            error.message,
        });
    }
  }
);


/**
 * 404
 */
app.use(
  (
    req,
    res
  ) => {

    return res
      .status(404)
      .json({

        success:
          false,

        error:
          "Route not found",
      });
  }
);


/**
 * Start.
 */
const PORT =
  process.env.PORT ||
  3000;


async function startServer() {

  try {

    await testDatabaseConnection();


    await initializeDatabase();


    /**
     * Load Skills once at startup.
     *
     * Failure does not prevent server startup.
     */
    try {

      const skills =
        await getAvailableSkills();


      console.log(
        `Startup Skill sync complete: ${skills.length} Skill(s).`
      );

    } catch (error) {

      console.error(
        "Initial Skill sync failed:",
        error.message
      );
    }


    app.listen(

      PORT,

      "0.0.0.0",

      () => {

        console.log(
          `Claude Cliq Agent running on port ${PORT}`
        );
      }
    );


  } catch (error) {

    console.error(
      "Application startup failed:",
      error
    );


    process.exit(1);
  }
}


startServer();