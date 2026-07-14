require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
});

const databaseUrl = `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const encodedPassword = encodeURIComponent(process.env.DB_PASS);
const encodedDatabaseUrl = `postgresql://${process.env.DB_USER}:${encodedPassword}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

module.exports = {
        databaseUrl,
        encodedDatabaseUrl,
        query: (text, params) => pool.query(text, params),
        connect: () => pool.connect()
};
