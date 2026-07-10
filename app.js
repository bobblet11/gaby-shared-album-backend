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

                // 1) Parse multipart form manually via Multer
                await new Promise((resolve, reject) => {
                        upload.single(image_form_field)(req, res, (err) => {
                                if (err) reject(err);
                                else resolve();
                        });
                });
                if (!req.file) throw new Error("No file uploaded");
            
                // 2) Get db fields
                const { title, caption } = req.body;
                const now = new Date();
                const dateTime = now.toISOString();
                const dateOnly = dateTime.split("T")[0];

                

                // 3) Create hash using image + metadata + current time
                const tempPath = req.file.path;
                const fileBuffer = await fs.readFile(tempPath);
                const hash = crypto
                        .createHash("sha256")
                        .update(fileBuffer)
                        .update(title || "")
                        .update(caption || "")
                        .update(dateTime)
                        .digest("hex");

                
                const dup = await client.query(`SELECT id FROM ${photosTable} WHERE id = $1`, [hash]);
                if (dup.rows.length > 0) {
                        // cleanup temp and return existing row
                        await fs.unlink(tempPath).catch(() => {});
                        const existing = await client.query(`SELECT * FROM ${photosTable} WHERE id = $1`, [hash]);
                        await client.query("COMMIT");
                        return res.json(existing.rows[0]);
                }
                
                
                // 4) Create downsized + full scale images
                const ext = path.extname(req.file.originalname) || (req.file.mimetype === "image/png" ? ".png" : ".jpg");
                const origPath = path.join(base_path, original_scale_image_path, `${hash}_orig${ext}`);
                const fullPath = path.join(base_path, full_scale_image_path, `${hash}_full${ext}`);
                const downPath = path.join(base_path, down_scale_image_path, `${hash}_down${ext}`);

                // Original: move temp file
                await fs.rename(tempPath, origPath);

                // Full scale (~1MB target)
                await sharp(fileBuffer).resize({ width: 1200 }).jpeg({ quality: 80 }).toFile(fullPath);

                // Downscale tiny blurry placeholder
                await sharp(fileBuffer).resize(20).blur(10).toFile(downPath);

                const imageEndpoint = `media/${path.basename(fullPath)}`;
                const placeholderEndpoint = `media/${path.basename(downPath)}`;

                // 5) Insert row into DB
                const result = await client.query(
                        `INSERT INTO ${photosTable} (id, title, caption, upload_date, image_endpoint, placeholder_endpoint)
                        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                        [hash, title, caption, dateOnly, 
                            path.join(full_scale_image_path, `${hash}_full${ext}`), 
                            path.join(down_scale_image_path, `${hash}_down${ext}`)],
                );

                await client.query("COMMIT");
                res.json(result.rows[0]);
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

app.listen(PORT, (error) => {
        if (!error) {
                console.log("Server is Successfully Running, and App is listening on port " + PORT);
        } else {
                console.log("Error occurred, server can't start", error);
        }
});
