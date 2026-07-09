// run: node scripts/test-db.js
require("dotenv").config();
const db = require("../db.js");

(async () => {
        try {
                const res = await db.query("SELECT NOW()");
                console.log("Postgres connected:", res.rows[0]);
                process.exit(0);
        } catch (err) {
                console.error("DB connection failed", err);
                process.exit(1);
        }
})();
