import { env } from "./src/config/env";
console.log("PORT:", env.PORT);
console.log("MONGODB_URI:", env.MONGODB_URI ? "Present" : "Missing");
