
import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

const PORT = Number(process.env.PORT) || 5000;

async function startServer(): Promise<void> {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.info("[SERVER] Startup completed successfully.");
    });
  } catch {
    console.error("[SERVER] Startup failed.");
    process.exit(1);
  }
}

void startServer();
