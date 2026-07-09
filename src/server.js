import "dotenv/config";

import express from "express";
import cors from "cors";

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
  extractConversationIdentifiers,
  buildSessionKey,
} from "./context.js";


const app = express();


app.use(cors());


app.use(
  express.json({
    limit: "5mb",
  })
);


/**
 * ------------------------------------------------
 * HEALTH
 * ------------------------------------------------
 */
app.get("/health", async (req, res) => {

  try {

    return res.json({
      success: true,
      service: "cliq-claude-agent",
      database: "configured",
      status: "running",
      timestamp:
        new Date().toISOString(),
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


/**
 * ------------------------------------------------
 * DATABASE HEALTH
 * ------------------------------------------------
 */
app.get("/health/db", async (req, res) => {

  try {

    const result =
      await testDatabaseConnection();


    return res.json({
      success: true,
      database: "connected",
    });

  } catch (error) {

    console.error(error);


    return res.status(500).json({
      success: false,
      database: "connection failed",
      error: error.message,
    });
  }
});


/**
 * ------------------------------------------------
 * CLIQ MENTION
 * ------------------------------------------------
 */
app.post(
  "/api/cliq/mention",

  async (req, res) => {

    try {

      const {
        message,

        user_name,
        user_id,
        user_email,

        chat_id,
        channel_id,
        channel_name,

        message_id,
        thread_id,
        root_message_id,

        message_details,
        attachments,
      } = req.body;


      if (
        !message ||
        !String(message).trim()
      ) {

        return res
          .status(400)
          .json({

            success: false,

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


      console.log(
        "Message Details:",
        JSON.stringify(
          message_details || null,
          null,
          2
        )
      );


      /**
       * -----------------------------------------
       * DETECT CONVERSATION IDs
       * -----------------------------------------
       */
      const identifiers =
        extractConversationIdentifiers({

          threadId:
            thread_id,

          rootMessageId:
            root_message_id,

          messageId:
            message_id,

          messageDetails:
            message_details,
        });


      console.log(
        "Conversation IDs:",
        identifiers
      );


      /**
       * -----------------------------------------
       * BUILD SESSION KEY
       * -----------------------------------------
       */
      const sessionKey =
        buildSessionKey({

          threadId:
            identifiers.threadId,

          rootMessageId:
            identifiers.rootMessageId,

          messageId:
            identifiers.messageId,

          chatId:
            chat_id,
        });


      console.log(
        "Session Key:",
        sessionKey
      );


      /**
       * -----------------------------------------
       * GET OR CREATE SESSION
       * -----------------------------------------
       */
      const session =
        await getOrCreateSession({

          sessionKey,

          threadId:
            identifiers.threadId,

          rootMessageId:
            identifiers.rootMessageId,

          chatId:
            chat_id || null,

          channelId:
            channel_id || null,

          objective:
            String(message),

          createdBy:
            user_id || user_email || null,

          createdByName:
            user_name || null,
        });


      /**
       * -----------------------------------------
       * LOAD OLD HISTORY
       *
       * Important:
       * load history BEFORE saving current message,
       * otherwise current message would be included twice.
       * -----------------------------------------
       */
      const history =
        await getSessionMessages(
          session.id,
          30
        );


      /**
       * -----------------------------------------
       * BUILD REPLY CONTEXT
       * -----------------------------------------
       */
      const context =
        buildCliqContext({

          messageDetails:
            message_details || null,

          attachments:
            attachments || null,
        });


      /**
       * -----------------------------------------
       * CALL CLAUDE
       * -----------------------------------------
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
            channel_id ||
            chat_id ||
            "Unknown conversation",

          context,
        });


      /**
       * -----------------------------------------
       * SAVE USER MESSAGE
       * -----------------------------------------
       */
      await addSessionMessage({

        sessionId:
          session.id,

        role:
          "user",

        userId:
          user_id || null,

        userName:
          user_name || null,

        messageText:
          String(message),
      });


      /**
       * -----------------------------------------
       * SAVE CLAUDE RESPONSE
       * -----------------------------------------
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


      /**
       * -----------------------------------------
       * RESPONSE
       * -----------------------------------------
       */
      return res.json({

        success: true,

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

          usage:
            result.usage,
        },
      });


    } catch (error) {

      console.error(
        "Mention handler error:",
        error
      );


      return res
        .status(500)
        .json({

          success: false,

          error:
            "Claude request failed.",

          details:
            error.message,
        });
    }
  }
);


/**
 * ------------------------------------------------
 * 404
 * ------------------------------------------------
 */
app.use((req, res) => {

  return res
    .status(404)
    .json({

      success: false,

      error:
        "Route not found",
    });
});


/**
 * ------------------------------------------------
 * START APPLICATION
 * ------------------------------------------------
 */
const PORT =
  process.env.PORT || 3000;


async function startServer() {

  try {

    await testDatabaseConnection();

    await initializeDatabase();


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