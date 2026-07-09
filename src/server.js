import "dotenv/config";

import express from "express";
import cors from "cors";

import { askClaude } from "./claude.js";

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: "5mb",
  })
);


/**
 * ------------------------------------------------
 * HEALTH CHECK
 * ------------------------------------------------
 */
app.get("/health", (req, res) => {
  return res.json({
    success: true,
    service: "cliq-claude-agent",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});


/**
 * ------------------------------------------------
 * CLIQ MENTION HANDLER ENDPOINT
 * ------------------------------------------------
 */
app.post("/api/cliq/mention", async (req, res) => {
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

      message_details,
      mentions,

      attachments,
    } = req.body;


    /**
     * Validate message
     */
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }


    /**
     * Log incoming Cliq request
     */
    console.log("\n======================================");
    console.log("NEW CLIQ REQUEST");
    console.log("======================================");

    console.log("Message:", message);

    console.log("User:", {
      user_name,
      user_id,
      user_email,
    });

    console.log("Chat:", {
      chat_id,
      channel_id,
      channel_name,
    });

    console.log("Message IDs:", {
      message_id,
      thread_id,
    });


    console.log(
      "Message Details:",
      JSON.stringify(message_details || null, null, 2)
    );

    console.log(
      "Mentions:",
      JSON.stringify(mentions || null, null, 2)
    );

    console.log(
      "Attachments:",
      JSON.stringify(attachments || null, null, 2)
    );


    /**
     * Call Claude
     */
    const result = await askClaude({
      message: String(message),

      userName:
        user_name ||
        "Team member",

      channelName:
        channel_name ||
        channel_id ||
        chat_id ||
        "Unknown conversation",

      messageDetails:
        message_details || null,

      attachments:
        attachments || null,
    });


    /**
     * Return response
     */
    return res.json({
      success: true,

      response: {
        text: result.text,
      },

      metadata: {
        model: result.model,
        stop_reason: result.stopReason,
        usage: result.usage,
      },
    });

  } catch (error) {

    console.error("\n======================================");
    console.error("MENTION HANDLER ERROR");
    console.error("======================================");

    console.error(error);


    return res.status(500).json({
      success: false,

      error: "Claude request failed.",

      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});


/**
 * ------------------------------------------------
 * FALLBACK ROUTE
 * ------------------------------------------------
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Route not found",
  });
});


/**
 * ------------------------------------------------
 * ERROR HANDLER
 * ------------------------------------------------
 */
app.use((error, req, res, next) => {

  console.error("Unhandled server error:", error);

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});


/**
 * ------------------------------------------------
 * START SERVER
 * ------------------------------------------------
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Claude Cliq Agent running on port ${PORT}`
  );
});