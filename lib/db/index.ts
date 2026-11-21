import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { databaseConfig } from "@/lib/db/config";

export const client = createClient(databaseConfig);
export const db = drizzle(client);
