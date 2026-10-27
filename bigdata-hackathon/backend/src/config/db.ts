
import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from the .env file");
  }

  console.log("[DATABASE] Connecting to MongoDB...");

  await mongoose.connect(mongoUri);

  console.log("[DATABASE] MongoDB connected successfully.");
  console.log(`[DATABASE] Database: ${mongoose.connection.name}`);
}
