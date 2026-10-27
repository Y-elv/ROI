
import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

const PORT = Number(process.env.PORT) || 5000;

async function startServer(): Promise<void> {
  try {
    console.log("========================================");
    console.log(" Rwanda Opportunity Intelligence");
    console.log(" Backend starting...");
    console.log("========================================");

    await connectDB();

    app.listen(PORT, () => {
      console.log(`[SERVER] Running on port ${PORT}`);
      console.log(`[SERVER] Local URL: http://localhost:${PORT}`);
      console.log(
        `[SERVER] Health check: http://localhost:${PORT}/api/v1/health`
      );
      console.log("[SERVER] Startup completed successfully.");
    });
  } catch (error) {
    console.error("[STARTUP ERROR] Backend failed to start.");

    if (error instanceof Error) {
      console.error("[STARTUP ERROR] Reason:", error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

void startServer();
