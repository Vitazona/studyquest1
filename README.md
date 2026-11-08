# Study Quest

**Study Quest** is a gamified productivity web application designed to help students manage daily and weekly tasks, schedule study sessions using an interactive calendar with a study timer/alarm, and organize curriculum files (PDFs and images) in a personal cloud library.

---

## 📁 Project Structure

The project follows a standard Express Model-View-Controller (MVC) directory structure:

```text
StudyQuest/
├── config/
│   └── db.js                 # MongoDB client & GridFS bucket initialization
├── middleware/
│   ├── auth.js               # Route authentication guards (API and SSR views)
│   └── upload.js             # Multer upload handler for curriculum materials
├── public/                   # Public static assets
│   ├── assets/               # SVG icons, logos, and images
│   ├── css/                  # Stylesheets (theme, auth, pages)
│   └── js/                   # Client-side interactive scripts
├── routes/
│   ├── auth.routes.js        # Authentication API endpoints (/api/auth/*)
│   ├── curriculum.routes.js  # GridFS storage API endpoints (/api/curriculum/*)
│   └── view.routes.js        # Server-rendered EJS view routes
├── views/                    # EJS Templates
│   ├── auth/                 # Login and register views
│   ├── partials/             # Reusable UI partials (_head, _sidebar, etc.)
│   ├── calendar.ejs          # Calendar & Study Timer view
│   ├── curriculum.ejs        # Curriculum Upload & Viewer view
│   ├── home.ejs              # Dashboard Home view
│   └── yourtasks.ejs         # Personal Quest & Task Board view
├── .env                      # Local environment configuration (git-ignored)
├── .env.example              # Example environment template
├── .gitignore                # Git ignore rules
├── package.json              # Single authoritative npm configuration & plugin list
├── package-lock.json         # Exact dependency lockfile
├── server.js                 # Application entry point
└── README.md                 # Project documentation & plugin guide
```

---

## 📦 Required Plugins & Dependencies

All dependencies are defined in `package.json` and install with a single command (`npm install`).

### Production Plugins:
| Plugin / Package | Version | Purpose |
| :--- | :--- | :--- |
| **`express`** | `^5.3.0` | Core web application framework and routing. |
| **`ejs`** | `^3.1.10` | Embedded JavaScript templating engine for server-side view rendering. |
| **`mongodb`** | `^7.7.0` | Native MongoDB driver for database operations and GridFS bucket storage. |
| **`connect-mongo`** | `^6.0.0` | MongoDB-backed persistent session store for Express. |
| **`bcrypt`** | `^6.0.0` | Secure password hashing (12 salt rounds) for user credentials. |
| **`express-session`** | `^1.19.0` | Cookie-based session management middleware. |
| **`dotenv`** | `^18.0.9` | Environment variable management from `.env`. |
| **`multer`** | `^2.5.0` | Middleware for handling `multipart/form-data` file uploads. |

### Development Tools:
| Plugin / Tool | Version | Purpose |
| :--- | :--- | :--- |
| **`nodemon`** | `^3.1.14` | Automatically restarts the node application on code changes. |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: A running MongoDB instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 2. Installation
Install all project dependencies with:

```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env` (if not already present). The application also
loads `backend/.env` for setups that keep backend configuration there:

```bash
cp .env.example .env
```

Ensure the following variables are configured in `.env`:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=studyquest
SESSION_SECRET=your_secure_random_session_secret
MAX_FILE_SIZE_MB=15
```

### 4. Running the Application

- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

- **Production mode:**
  ```bash
  npm start
  ```

Once running, access the web application at: [http://localhost:3000](http://localhost:3000)

---

## 🌐 Routes Overview

### Web Pages (EJS):
- `/login` - User sign-in page
- `/register` - User sign-up page
- `/home` - Dashboard overview with date, focus tasks, and study progress
- `/yourtasks` - Quest board with Today, Daily, and Weekly task categories
- `/calendar` - Interactive monthly calendar and study timer (Stopwatch, Countdown, Alarm)
- `/curriculum` - Upload, preview, and manage study materials (PDF, JPG, PNG, WEBP)

### API Endpoints:
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Authenticate user and initiate session
- `GET /api/auth/me` - Fetch authenticated user info
- `POST /api/auth/logout` - Destroy session and clear cookie
- `POST /api/curriculum/upload` - Upload a curriculum document into MongoDB GridFS
- `GET /api/curriculum` - List uploaded files for the logged-in user
- `GET /api/curriculum/:id` - Stream or download a file from GridFS
- `DELETE /api/curriculum/:id` - Delete a file from GridFS
