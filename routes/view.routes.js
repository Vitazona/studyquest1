"use strict";

const express = require("express");
const { requirePageAuth, redirectIfLoggedIn } = require("../middleware/auth");

const router = express.Router();

// Root redirect
router.get("/", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/home");
  }
  return res.redirect("/login");
});

// Authentication Pages
router.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("auth/login", {
    title: "Login",
    prefillUsername: req.query.username || ""
  });
});

router.get("/register", redirectIfLoggedIn, (req, res) => {
  res.render("auth/register", {
    title: "Register"
  });
});

// Protected Dashboard Pages
router.get("/home", requirePageAuth, (req, res) => {
  res.render("home", {
    title: "Home",
    activePage: "home",
    user: res.locals.currentUser
  });
});

router.get("/yourtasks", requirePageAuth, (req, res) => {
  res.render("yourtasks", {
    title: "Your Tasks",
    activePage: "yourtasks",
    user: res.locals.currentUser
  });
});

router.get("/calendar", requirePageAuth, (req, res) => {
  res.render("calendar", {
    title: "Calendar & Time",
    activePage: "calendar",
    user: res.locals.currentUser
  });
});

router.get("/curriculum", requirePageAuth, (req, res) => {
  res.render("curriculum", {
    title: "Curriculum",
    activePage: "curriculum",
    user: res.locals.currentUser
  });
});

// Backwards-compatibility redirects for old .html links
router.get("/login.html", (req, res) => res.redirect(301, "/login"));
router.get("/register.html", (req, res) => res.redirect(301, "/register"));
router.get("/home.html", (req, res) => res.redirect(301, "/home"));
router.get("/yourtasks.html", (req, res) => res.redirect(301, "/yourtasks"));
router.get("/calendar.html", (req, res) => res.redirect(301, "/calendar"));
router.get("/curriculum.html", (req, res) => res.redirect(301, "/curriculum"));

module.exports = router;

