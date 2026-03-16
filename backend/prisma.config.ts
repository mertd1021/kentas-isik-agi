import { defineConfig } from "@prisma/config";
import dotenv from "dotenv";

// --- ENVIRONMENT VARIABLES ---
dotenv.config();

// --- PRISMA CONFIGURATION ---
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});