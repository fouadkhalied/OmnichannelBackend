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

//         console.log("Enabling pgvector extension...");
//         await client.query("CREATE EXTENSION IF NOT EXISTS vector;");

//         console.log("Extension enabled successfully!");
//     } catch (err) {
//         console.error("Error enabling extension:", err);
//     } finally {
//         await client.end();
//     }
// }

// main();
