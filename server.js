"use strict";

const dns = require("node:dns");
const path = require("node:path");

const dotenv = require("dotenv");

dotenv.config();
dotenv.config({ path: path.join(__dirname, "backend", ".env") });

// Fix for Windows / Node.js DNS SRV resolution issue with MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch {
  // Use system default if custom DNS is not permitted
}

const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const multer = require("multer");

const { client, DATABASE_NAME, connectDB } = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const curriculumRoutes = require("./routes/curriculum.routes");
const viewRoutes = require("./routes/view.routes");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required. Set it in .env.");
}

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS View Engine Configuration
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static assets (strictly scoped to public/)
app.use(express.static(path.join(__dirname, "public")));

// Session management with MongoStore
app.use(
  session({
    name: "studyquest.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      client,
      dbName: DATABASE_NAME,
      collectionName: "sessions"
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/curriculum", curriculumRoutes);
app.use("/", viewRoutes);

// Centralized Error Handling Middleware
app.use((error, req, res, next) => {
  console.error("Request failed:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const maxMB = process.env.MAX_FILE_SIZE_MB || 15;
    return res.status(status).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? `File is too large. The maximum size is ${maxMB} MB.`
          : error.message
    });
  }

  if (error.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      message: error.message
    });
  }

  // If request accepts HTML, render a friendly error or redirect
  if (req.accepts("html")) {
    return res.status(500).send("<h1>An unexpected server error occurred.</h1><p><a href='/'>Return home</a></p>");
  }

  return res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

// Start Server & Connect Database
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Study Quest is running at http://localhost:${PORT}`);
      console.log(`Connected to MongoDB database "${DATABASE_NAME}".`);
      console.log("GridFS curriculum storage is ready.");
    });
  } catch (error) {
    console.error("Could not start Study Quest:", error);
    process.exitCode = 1;
  }
}

startServer();
