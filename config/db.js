"use strict";

const dns = require("node:dns");

// Fix for Windows / Node.js DNS SRV resolution issue with MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch {
  // Use system default if custom DNS is not permitted
}

const { MongoClient, GridFSBucket } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DB || "studyquest";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Set it in .env.");
}

const client = new MongoClient(MONGODB_URI);
let database;
let usersCollection;
let curriculumBucket;

async function connectDB() {
  try {
    await client.connect();
    database = client.db(DATABASE_NAME);

    await database.command({ ping: 1 });

    usersCollection = database.collection("users");

    await usersCollection.createIndex(
      { usernameLower: 1 },
      { unique: true }
    );

    await usersCollection.createIndex(
      { email: 1 },
      { unique: true }
    );

    curriculumBucket = new GridFSBucket(database, {
      bucketName: "curriculum"
    });

    return { database, usersCollection, curriculumBucket };
  } catch (error) {
    if (error.code === "ECONNREFUSED" && error.syscall === "querySrv") {
      console.error("\n❌ MongoDB Connection Error (querySrv ECONNREFUSED):");
      console.error("DNS SRV lookup failed for: " + (error.hostname || "cluster0.j23xvbs.mongodb.net"));
      console.error("This usually occurs because your local router/ISP DNS does not support SRV records, or the MongoDB Atlas cluster is paused.");
    }
    throw error;
  }
}

function getDatabase() {
  if (!database) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return database;
}

function getUsersCollection() {
  if (!usersCollection) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return usersCollection;
}

function getCurriculumBucket() {
  if (!curriculumBucket) {
    throw new Error("GridFS bucket not initialized. Call connectDB() first.");
  }
  return curriculumBucket;
}

module.exports = {
  client,
  DATABASE_NAME,
  connectDB,
  getDatabase,
  getUsersCollection,
  getCurriculumBucket
};

