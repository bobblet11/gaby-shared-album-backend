#!/usr/bin/env node

/**
 * Simple PostgreSQL Migration Runner
 *
 * Usage:
 *   node migrate.js up              - Run all pending migrations
 *   node migrate.js down            - Rollback last migration
 *   node migrate.js status          - Show migration status
 *   node migrate.js create <name>   - Create new migration file
 *
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *   Or use DATABASE_URL connection string
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const db = require("./../db"); 

// Configuration
const config = {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "postgres",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        // If DATABASE_URL is provided, it takes precedence
        connectionString: db.encodedDatabaseUrl,
};

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(process.cwd(), "migrations");
const MIGRATIONS_TABLE = process.env.MIGRATIONS_TABLE || "public.migrations";
const MIGRATIONS_SCHEMA = MIGRATIONS_TABLE.split(".")[0];

// Database helper
class MigrationRunner {
        constructor() {
                this.client = null;
        }

        async connect() {
                this.client = new Client(config);
                await this.client.connect();
        }

        async disconnect() {
                if (this.client) {
                        await this.client.end();
                }
        }

        async ensureMigrationsTable() {
                await this.client.query(`
      CREATE SCHEMA IF NOT EXISTS ${MIGRATIONS_SCHEMA};

      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        }

        async getAppliedMigrations() {
                const result = await this.client.query(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`);
                return result.rows.map((row) => row.name);
        }

        async getPendingMigrations() {
                const applied = await this.getAppliedMigrations();
                const allMigrations = this.getAllMigrationFiles();
                return allMigrations.filter((m) => !applied.includes(m));
        }

        getAllMigrationFiles() {
                if (!fs.existsSync(MIGRATIONS_DIR)) {
                        return [];
                }
                const files = fs
                        .readdirSync(MIGRATIONS_DIR)
                        .filter((f) => f.endsWith(".sql"))
                        .sort();
                return files;
        }

        async runMigration(filename) {
                const filepath = path.join(MIGRATIONS_DIR, filename);
                const sql = fs.readFileSync(filepath, "utf8");

                console.log(`Running migration: ${filename}`);

                try {
                        await this.client.query("BEGIN");

                        // Execute the migration SQL
                        await this.client.query(sql);

                        // Record migration
                        await this.client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name, created_at) VALUES ($1, CURRENT_TIMESTAMP)`, [filename]);

                        await this.client.query("COMMIT");
                        console.log(`✓ Successfully applied: ${filename}`);
                } catch (error) {
                        await this.client.query("ROLLBACK");
                        console.error(`✗ Failed to apply: ${filename}`);
                        throw error;
                }
        }

        async rollbackLastMigration() {
                const applied = await this.getAppliedMigrations();
                if (applied.length === 0) {
                        console.log("No migrations to rollback");
                        return;
                }

                const lastMigration = applied[applied.length - 1];
                console.log(`⚠️  Rolling back: ${lastMigration}`);
                console.log("⚠️  WARNING: This will delete the migration record but NOT undo the SQL changes.");
                console.log("⚠️  You must manually revert database changes if needed.");

                await this.client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [lastMigration]);
                console.log(`✓ Removed migration record: ${lastMigration}`);
        }

        async showStatus() {
                const applied = await this.getAppliedMigrations();
                const all = this.getAllMigrationFiles();
                const pending = all.filter((m) => !applied.includes(m));

                console.log("\n=== Migration Status ===\n");
                console.log(`Applied migrations: ${applied.length}`);
                console.log(`Pending migrations: ${pending.length}`);
                console.log(`Total migrations: ${all.length}\n`);

                if (applied.length > 0) {
                        console.log("Applied:");
                        applied.forEach((m) => console.log(`  ✓ ${m}`));
                }

                if (pending.length > 0) {
                        console.log("\nPending:");
                        pending.forEach((m) => console.log(`  ○ ${m}`));
                }

                console.log("");
        }

        createMigrationFile(name) {
                if (!fs.existsSync(MIGRATIONS_DIR)) {
                        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
                }

                const timestamp = new Date()
                        .toISOString()
                        .replace(/[-:T.Z]/g, "")
                        .slice(0, 14);

                const filename = `${timestamp}_${name.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}.sql`;
                const filepath = path.join(MIGRATIONS_DIR, filename);

                const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here

`;

                fs.writeFileSync(filepath, template);
                console.log(`✓ Created migration file: ${filename}`);
        }
}

// CLI handler
async function main() {
        const [, , command, ...args] = process.argv;

        if (!command || command === "help") {
                console.log(`
Simple PostgreSQL Migration Tool

Usage:
  node migrate.js up              - Run all pending migrations
  node migrate.js down            - Rollback last migration
  node migrate.js status          - Show migration status
  node migrate.js create <name>   - Create new migration file

Environment variables:
  DB_HOST              - Database host (default: localhost)
  DB_PORT              - Database port (default: 5432)
  DB_NAME              - Database name (default: postgres)
  DB_USER              - Database user (default: postgres)
  DB_PASSWORD          - Database password
  DATABASE_URL         - Full connection string (overrides individual vars)
  MIGRATIONS_DIR       - Path to migrations directory (default: ./migrations)
  MIGRATIONS_TABLE     - Table name for tracking (default: public.migrations)
`);
                process.exit(0);
        }

        const runner = new MigrationRunner();

        try {
                if (command === "create") {
                        if (!args[0]) {
                                console.error("Error: Migration name required");
                                console.log("Usage: node migrate.js create <migration_name>");
                                process.exit(1);
                        }
                        runner.createMigrationFile(args[0]);
                        return;
                }

                await runner.connect();
                await runner.ensureMigrationsTable();

                switch (command) {
                        case "up":
                                const pending = await runner.getPendingMigrations();
                                if (pending.length === 0) {
                                        console.log("✓ No pending migrations");
                                        break;
                                }
                                console.log(`Found ${pending.length} pending migration(s)\n`);
                                for (const migration of pending) {
                                        await runner.runMigration(migration);
                                }
                                console.log(`\n✓ All migrations completed`);
                                break;

                        case "down":
                                await runner.rollbackLastMigration();
                                break;

                        case "status":
                                await runner.showStatus();
                                break;

                        default:
                                console.error(`Unknown command: ${command}`);
                                console.log('Run "node migrate.js help" for usage');
                                process.exit(1);
                }
        } catch (error) {
                console.error("\n✗ Migration failed:", error.message);
                console.error(error.stack);
                process.exit(1);
        } finally {
                await runner.disconnect();
        }
}

main();
