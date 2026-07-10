require("dotenv").config();
const sharp = require("sharp");
const fs = require("fs").promises;
const fssync = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const express = require("express");
const bodyParser = require("body-parser");
const db = require("./db"); // make sure db.js exports connect()
const PORT = process.env.API_PORT;
const app = express();

app.use(bodyParser.json());
app.use(
        bodyParser.urlencoded({
                extended: true,
        }),
);

const photosTable = "photos";
const accountsTable = "account";

const base_path = "/var/www/gaby-shared-album"
const temp_image_path = process.env.TEMP_IMAGE_FILE_PATH;
const original_scale_image_path = process.env.ORIGINAL_SCALE_IMAGE_FILE_PATH;
const full_scale_image_path = process.env.FULL_SCALE_IMAGE_FILE_PATH;
const down_scale_image_path = process.env.DOWN_SCALE_IMAGE_FILE_PATH;

for (const dir of [temp_image_path, original_scale_image_path, full_scale_image_path, down_scale_image_path]) {
        if (!fssync.existsSync(`${base_path}/${dir}`)) fssync.mkdirSync(`${base_path}/${dir}`, { recursive: true });
}


const storage = multer.diskStorage({
        destination: (req, file, cb) => {
                cb(null, `${base_path}/${temp_image_path}`);
        },
        filename: (req, file, cb) => {
                cb(null, Date.now() + "-" + file.originalname);
        },
});
const upload = multer({ storage: storage });
const image_form_field = "image";

app.get("/api/photo", async (req, res) => {
        try {
                console.log("HERE");
                const result = await db.query(`SELECT * FROM ${photosTable}`);
                console.log(result.rows);
                res.json(result.rows);
        } catch (err) {
                console.error(err);
                res.status(500).send("Internal Server Error");
        }
});

app.get("/api/photo/:id", async (req, res) => {
        try {
                const result = await db.query(`SELECT * FROM ${photosTable} WHERE id = $1`, [req.params.id]);
                if (result.rows.length === 0) return res.status(404).send("Not found");
                res.json(result.rows[0]);
        } catch (err) {
                console.error(err);
                res.status(500).send("Internal Server Error");
        }
});

app.post("/api/photo", async (req, res) => {
        let client;
        try {
                client = await db.connect();
                await client.query("BEGIN");

                // Use Multer for multiple files
                await new Promise((resolve, reject) => {
                        upload.array(image_form_field)(req, res, (err) => {
                                if (err) reject(err);
                                else resolve();
                        });
                });
                if (!req.files || req.files.length === 0) throw new Error("No files uploaded");

                const { title, caption } = req.body;
                const now = new Date();
                const dateTime = now.toISOString();
                const dateOnly = dateTime.split("T")[0];

                const results = [];

                for (const file of req.files) {
                        const tempPath = file.path;
                        const fileBuffer = await fs.readFile(tempPath);

                        // Hash per file (metadata optional)
                        const hash = crypto
                                .createHash("sha256")
                                .update(fileBuffer)
                                .update(title || "")
                                .update(caption || "")
                                .update(dateTime)
                                .digest("hex");

                        // Check duplicates
                        const dup = await client.query(`SELECT id FROM ${photosTable} WHERE id = $1`, [hash]);
                        if (dup.rows.length > 0) {
                                await fs.unlink(tempPath).catch(() => {});
                                const existing = await client.query(`SELECT * FROM ${photosTable} WHERE id = $1`, [hash]);
                                results.push(existing.rows[0]);
                                continue;
                        }

                        // File paths
                        const ext = path.extname(file.originalname) || (file.mimetype === "image/png" ? ".png" : ".jpg");
                        const origPath = path.join(base_path, original_scale_image_path, `${hash}_orig${ext}`);
                        const fullPath = path.join(base_path, full_scale_image_path, `${hash}_full${ext}`);
                        const downPath = path.join(base_path, down_scale_image_path, `${hash}_down${ext}`);

                        // Move original
                        await fs.rename(tempPath, origPath);

                        // Full scale
                        await sharp(fileBuffer).resize({ width: 1200 }).jpeg({ quality: 80 }).toFile(fullPath);

                        // Downscale placeholder
                        await sharp(fileBuffer).resize(20).blur(10).toFile(downPath);

                        const imageEndpoint = path.join(full_scale_image_path, `${hash}_full${ext}`);
                        const placeholderEndpoint = path.join(down_scale_image_path, `${hash}_down${ext}`);

                        // Insert row — if title/caption are empty, store NULL
                        const result = await client.query(
                                `INSERT INTO ${photosTable} (id, title, caption, upload_date, image_endpoint, placeholder_endpoint)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                                [hash, title && title.trim() ? title : null, caption && caption.trim() ? caption : null, dateOnly, imageEndpoint, placeholderEndpoint],
                        );
                        results.push(result.rows[0]);
                }

                await client.query("COMMIT");
                res.json(results); // return array of inserted/duplicate rows
        } catch (err) {
                console.error("Upload error:", err);
                if (client) {
                        try {
                                await client.query("ROLLBACK");
                        } catch (e) {
                                console.error("Rollback failed", e);
                        }
                }
                res.status(500).send("Internal Server Error");
        } finally {
                if (client) client.release();
        }
});

app.post("/api/photo/delete", async (req, res) => {
        let client;
        try {
                client = await db.connect();
                await client.query("BEGIN");

                const { imageEndpoint, placeholderEndpoint } = req.body;
                if (!imageEndpoint) return res.status(400).send("Missing imageEndpoint");
                if (!placeholderEndpoint) return res.status(400).send("Missing placeholderEndpoint");

                // Extract the hash (id) from the filename
                const fileName = path.basename(imageEndpoint); // e.g. "abc123_full.jpg"
                const imageId = fileName.split("_")[0]; // → "abc123"

                const fullPath = path.join(base_path, imageEndpoint);
                const downPath = path.join(base_path, placeholderEndpoint);

                await fs.unlink(fullPath).catch(() => {});
                await fs.unlink(downPath).catch(() => {});

                const result = await client.query(`DELETE FROM ${photosTable} WHERE id = $1 RETURNING *`, [imageId]);

                await client.query("COMMIT");
                if (result.rows.length === 0) return res.status(404).send("Not found");
                res.json(result.rows[0]);
        } catch (err) {
                console.error("Delete error:", err);
                if (client) {
                        try {
                                await client.query("ROLLBACK");
                        } catch (e) {
                                console.error("Rollback failed", e);
                        }
                }
                res.status(500).send("Internal Server Error");
        } finally {
                if (client) client.release();
        }
});



app.listen(PORT, (error) => {
        if (!error) {
                console.log("Server is Successfully Running, and App is listening on port " + PORT);
        } else {
                console.log("Error occurred, server can't start", error);
        }
});
