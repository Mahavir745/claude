import "dotenv/config";

import express from "express";
import cors from "cors";

import { askClaude } from "./claude.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));


/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "cliq-claude-agent",
    status: "running",
  });
});


/**
 * Zoho Cliq mention endpoint
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
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }

    console.log("Incoming Cliq request:", {
      user_name,
      user_id,
      chat_id,
      channel_id,
      channel_name,
      message_id,
      thread_id,
      message,
    });

    const result = await askClaude({
      message,
      userName: user_name || "Team member",
      channelName: channel_name || channel_id || "Unknown channel",
    });

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

    console.error("Mention handler error:", error);

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


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Claude Cliq Agent running on http://localhost:${PORT}`
  );
});