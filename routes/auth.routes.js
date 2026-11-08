"use strict";

const express = require("express");
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const { getUsersCollection } = require("../config/db");

const router = express.Router();

// ========================================
// AUTHENTICATION: REGISTER
// ========================================
router.post("/register", async (req, res, next) => {
  try {
    const users = getUsersCollection();
    const body = req.body || {};

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    if (!/^[a-zA-Z0-9_]{5,30}$/.test(username)) {
      return res.status(400).json({
        message:
          "Username must be 5-30 characters and use only letters, numbers, or underscores."
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return res.status(400).json({
        message: "Enter a valid email address."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match."
      });
    }

    const strongPassword =
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (
      password.length < 8 ||
      !strongPassword ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol. It must not exceed 72 bytes."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      username,
      usernameLower: username.toLowerCase(),
      email,
      passwordHash,
      createdAt: new Date()
    });

    return res.status(201).json({
      message: "Account created. You can now log in.",
      user: {
        id: result.insertedId.toString(),
        username,
        email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(
        error.keyPattern || {}
      )[0];

      const message =
        duplicateField === "email"
          ? "That email address is already registered."
          : "That username is already taken.";

      return res.status(409).json({ message });
    }

    next(error);
  }
});

// ========================================
// AUTHENTICATION: LOGIN
// ========================================
router.post("/login", async (req, res, next) => {
  try {
    const users = getUsersCollection();
    const body = req.body || {};

    const login =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!login || !password) {
      return res.status(400).json({
        message: "Enter your username and password."
      });
    }

    const user = await users.findOne({
      $or: [
        { usernameLower: login },
        { email: login }
      ]
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Incorrect username/email or password."
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate(error =>
        error ? reject(error) : resolve()
      );
    });

    req.session.userId = user._id.toString();

    await new Promise((resolve, reject) => {
      req.session.save(error =>
        error ? reject(error) : resolve()
      );
    });

    return res.json({
      message: "Login successful.",
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// AUTHENTICATION: CURRENT USER
// ========================================
router.get("/me", async (req, res, next) => {
  try {
    if (
      !req.session ||
      !req.session.userId ||
      !ObjectId.isValid(req.session.userId)
    ) {
      return res.status(401).json({
        message: "You are not logged in."
      });
    }

    const users = getUsersCollection();
    const user = await users.findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { username: 1, email: 1 } }
    );

    if (!user) {
      return res.status(401).json({
        message: "Your account could not be found."
      });
    }

    return res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// AUTHENTICATION: LOGOUT
// ========================================
router.post("/logout", (req, res, next) => {
  if (!req.session) {
    return res.json({ message: "Logged out." });
  }

  req.session.destroy(error => {
    if (error) return next(error);

    res.clearCookie("studyquest.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    return res.json({ message: "Logged out." });
  });
});

module.exports = router;

