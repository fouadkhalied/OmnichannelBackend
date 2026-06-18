// import pg from "pg";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dotenv.config({ path: path.join(__dirname, "..", ".env") });

// async function main() {
//     const databaseUrl = process.env.DATABASE_URL;
//     if (!databaseUrl) {
//         console.error("DATABASE_URL not found in .env");
//         process.exit(1);
//     }

//     const { Client } = pg;
//     const client = new Client({
//         connectionString: databaseUrl,
//         ssl: {
//             rejectUnauthorized: false
//         }
//     });

//     try {
//         console.log("Connecting to database...");
//         await client.connect();

//         console.log("Dropping public schema...");
//         await client.query("DROP SCHEMA public CASCADE;");

//         console.log("Recreating public schema...");
//         await client.query("CREATE SCHEMA public;");

//         console.log("Granting permissions...");
//         await client.query("GRANT ALL ON SCHEMA public TO public;");
//         await client.query("GRANT ALL ON SCHEMA public TO neondb_owner;");

//         console.log("Re-enabling pgvector extension...");
//         await client.query("CREATE EXTENSION IF NOT EXISTS vector;");

//         console.log("Database reset successfully!");
//     } catch (err) {
//         console.error("Error resetting database:", err);
//     } finally {
//         await client.end();
//     }
// }

// main();
