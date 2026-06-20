import { env } from "./src/config/env";
console.log("PORT:", env.PORT);
console.log("DATABASE_URL:", env.DATABASE_URL ? "Present" : "Missing");
