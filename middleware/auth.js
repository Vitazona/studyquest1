"use strict";

const { ObjectId } = require("mongodb");
const { getUsersCollection } = require("../config/db");

// Authentication middleware for JSON API endpoints
function requireLogin(req, res, next) {
  if (
    !req.session ||
    !req.session.userId ||
    !ObjectId.isValid(req.session.userId)
  ) {
    return res.status(401).json({
      message: "Please log in to access this feature."
    });
  }

  next();
}

// Authentication middleware for server-rendered HTML/EJS pages
async function requirePageAuth(req, res, next) {
  try {
    if (
      !req.session ||
      !req.session.userId ||
      !ObjectId.isValid(req.session.userId)
    ) {
      return res.redirect("/login");
    }

    const users = getUsersCollection();
    const user = await users.findOne(
      { _id: new ObjectId(req.session.userId) },
      { projection: { username: 1, email: 1 } }
    );

    if (!user) {
      req.session.destroy(() => {});
      return res.redirect("/login");
    }

    res.locals.currentUser = {
      id: user._id.toString(),
      username: user.username,
      email: user.email
    };

    next();
  } catch (error) {
    next(error);
  }
}

// Redirect already logged-in users away from login/register pages
function redirectIfLoggedIn(req, res, next) {
  if (
    req.session &&
    req.session.userId &&
    ObjectId.isValid(req.session.userId)
  ) {
    return res.redirect("/home");
  }
  next();
}

module.exports = {
  requireLogin,
  requirePageAuth,
  redirectIfLoggedIn
};

