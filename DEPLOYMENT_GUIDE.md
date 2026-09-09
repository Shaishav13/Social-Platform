# 🚀 UdtaBirdie — 100% Free & Highly Secure Production Deployment Guide

This guide details how to deploy the entire UdtaBirdie platform for **zero cost ($0.00)** using modern, production-grade cloud tiers with **maximum security** enforced at every layer.

---

## 🏗️ Architecture & Free Cloud Providers

| Component | Free Provider | Free Tier Specification | Security / TLS |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Vercel** | Unlimited edge bandwidth, global CDN | Automatic SSL, HSTS, SPA rewriting |
| **Backend API** | **Render.com** | Free Web Service (Node.js/Express) | Automatic HTTPS, isolated runtime |
| **Database** | **Neon.tech** | 0.5 GB PostgreSQL, serverless, pooling | Forced SSL (`sslmode=require`) |
| **Cache & Limiting** | **Upstash** | 10,000 Redis commands/day | Encrypted TLS (`rediss://`) |
| **Media Storage** | **Cloudflare R2** *(Optional)* | 10 GB S3-compatible, $0 egress fees | Authenticated API / S3 credentials |

> [!NOTE]
> All chosen services require **no credit card upfront** to get started and offer 100% free forever tiers.

---

## 🛡️ Top-Priority Security Measures Implemented Before Deployment

Before deploying, the codebase has been hardened with:
1. **SSL/TLS Database Connectors**: Automatic SSL negotiation (`rejectUnauthorized: false` for cloud self-signed certs) for Neon/Supabase PostgreSQL.
2. **Encrypted Redis Transport**: Full support for Upstash `rediss://` TLS protocol.
3. **Dynamic CORS Origin Pinning**: Strictly rejects unauthorized domains and supports whitespace-trimmed `ALLOWED_ORIGINS`.
4. **Active Content & Traversal Defense**: Media uploads are restricted to safe extensions (`.jpg`, `.png`, `.webp`, `.mp4`), inspected against script tags (`<script`, `<?php`, `javascript:`), and bounded to prevent path traversal (`../`).
5. **No Secret Leakage**: Password reset tokens, internal server stacks, and search PII are completely redacted.
6. **Vercel SPA Routing & Security Headers**: Custom `vercel.json` adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and client-side routing rewrites.

---

## 📋 Step-by-Step Deployment Walkthrough

### Step 1: Set Up Free PostgreSQL on Neon.tech (2 Minutes)

1. Go to **[https://neon.tech](https://neon.tech)** and sign up (Log in with GitHub).
2. Click **Create Project**:
   - **Project Name**: `udtabirdie`
   - **Region**: Select the region nearest to your target users (e.g., `US East (Ohio)` or `Europe (Frankfurt)`).
   - **Postgres Version**: 16 (default).
3. Once created, copy the connection string under **Connection Details**:
   - Select **Pooled connection**
   - Copy the URL (format: `postgresql://user:password@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`).
4. **Initialize the Database Schema**:
   - In the Neon Console sidebar, click **SQL Editor**.
   - Open [backend/scripts/init-db.sql](file:///d:/project2.0/miss/backend/scripts/init-db.sql) in this repository.
   - Copy the entire SQL content, paste it into the Neon SQL Editor, and click **Run**.
   - Ensure all tables (`users`, `posts`, `comments`, `likes`, `follows`, `follow_requests`, `blogs`, `notifications`, `content_flags`, `email_verifications`) are created.

---

### Step 2: Set Up Free Redis on Upstash (1 Minute)

1. Go to **[https://upstash.com](https://upstash.com)** and sign up (Log in with GitHub).
2. Click **Create Database**:
   - **Name**: `udtabirdie-redis`
   - **Type**: Regional
   - **Region**: Pick the same or closest region as Neon/Render (e.g., `us-east-1`).
   - **TLS**: Enabled (default).
3. Under the **Details** tab, scroll down to the **Node.js** or **ioredis/redis** section.
4. Copy the connection string starting with `rediss://` (example: `rediss://default:abc123xyz@us1-fluent-bobcat-12345.upstash.io:6379`).

---

### Step 3: Push Your Codebase to GitHub

If your code is not yet in a GitHub repository:
```bash
git add .
git commit -m "chore: prepare for production deployment with security hardening"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

---

### Step 4: Deploy the Backend on Render.com (3 Minutes)

1. Go to **[https://render.com](https://render.com)** and log in with GitHub.
2. Click **New +** → **Web Service**.
3. Select your GitHub repository.
4. Configure the service settings:
   - **Name**: `udtabirdie-api`
   - **Region**: Match your database region (e.g., `Ohio (US East)`).
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. Click **Advanced** → **Add Environment Variable** and enter:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security & logging |
| `PORT` | `10000` | Render default port |
| `DATABASE_URL` | *Your Neon PostgreSQL connection string* | Must include `?sslmode=require` |
| `REDIS_URL` | *Your Upstash Redis connection string* | Must start with `rediss://` |
| `JWT_SECRET` | *Random 64-character secret* | Generate using command below |
| `JWT_REFRESH_SECRET` | *Random 64-character secret* | Generate using command below |
| `ALLOWED_ORIGINS` | `http://localhost:3001` *(temporarily)* | Update in Step 6 after frontend is live |
| `TRUST_PROXY` | `true` | Required for secure cookies & reverse proxies |
| `BCRYPT_ROUNDS` | `12` | High-security password hashing |
| `SMTP_HOST` | `smtp.gmail.com` *(or SendGrid, Resend, Brevo, SES)* | Optional: Free SMTP server host |
| `SMTP_PORT` | `587` | Standard SMTP submission port |
| `SMTP_SECURE` | `false` | `true` for port 465, `false` for 587 |
| `SMTP_USER` | `your-email@gmail.com` | SMTP username or API key |
| `SMTP_PASS` | `your-app-password` | SMTP app password or API secret |
| `EMAIL_FROM` | `"UdtaBirdie" <noreply@yourdomain.com>` | Sender header address |
| `FRONTEND_URL` | `https://udtabirdie.vercel.app` | Base URL for password reset links |

> [!TIP]
> **Generate High-Entropy Secrets Locally**:
> In PowerShell or terminal, run:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```
> Run it twice: once for `JWT_SECRET` and once for `JWT_REFRESH_SECRET`.

6. Click **Create Web Service**.
7. Wait ~2 minutes for the build to finish. Once live, copy your backend URL:
   `https://udtabirdie-api.onrender.com`
8. Verify health endpoint in your browser:
   `https://udtabirdie-api.onrender.com/health` → should return `{"status":"OK", ...}`.

---

### Step 5: Deploy the Frontend on Vercel (2 Minutes)

1. Go to **[https://vercel.com](https://vercel.com)** and log in with GitHub.
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.
4. Configure the project:
   - **Project Name**: `udtabirdie`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`.
   - **Build Command**: `npm run build` (or leave default)
   - **Output Directory**: `dist` (default)
5. Expand **Environment Variables** and add:

| Key | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://udtabirdie-api.onrender.com/api/v1` *(replace with your Render backend URL)* |
| `VITE_APP_NAME` | `UdtaBirdie` |
| `VITE_APP_VERSION` | `1.0.0` |

6. Click **Deploy**.
7. Once deployed, Vercel will give you a domain (e.g., `https://udtabirdie.vercel.app`).

---

### Step 6: Connect CORS & Complete Security Lock (1 Minute)

1. Return to **Render.com** → Your `udtabirdie-api` service → **Environment**.
2. Update `ALLOWED_ORIGINS` to your Vercel URL:
   ```env
   ALLOWED_ORIGINS=https://udtabirdie.vercel.app
   ```
3. Click **Save Changes**. Render will automatically redeploy with the strict CORS lock.
4. Only requests originating from your secure HTTPS Vercel domain will be permitted.

---

## 🗄️ Handling Media Uploads (Zero-Cost Storage Guide)

Render's free tier uses an **ephemeral disk**. This means:
- Uploaded avatars and post media stored in `./uploads` will work immediately during operation.
- However, when the free instance spins down (after 15 minutes of inactivity) or redeploys, files in `./uploads` are erased.

### How to Make File Storage 100% Persistent for Free:

Use **Cloudflare R2** (Free Tier):
- **10 GB storage free forever**
- **$0 egress fees** (bandwidth is 100% free)
- Fully compatible with standard S3 protocols.

**Steps to configure Cloudflare R2**:
1. Sign up at [Cloudflare.com](https://cloudflare.com) and go to **R2**.
2. Create a bucket named `udtabirdie-media`.
3. Generate an R2 API Token with *Object Read & Write* permissions.
4. Add these environment variables in your Render backend:
   ```env
   STORAGE_TYPE=s3
   S3_BUCKET=udtabirdie-media
   S3_REGION=auto
   S3_ENDPOINT=https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY>
   S3_SECRET_ACCESS_KEY=<YOUR_R2_SECRET_KEY>
   ```
Now, all images and videos will persist permanently in the cloud at $0 cost!

---

## ✅ Post-Deployment Verification Checklist

1. **User Registration & Login**: Open `https://udtabirdie.vercel.app/register`, create an account, and log in.
2. **Post Creation & Media**: Publish a test post with an image and text.
3. **Private Account Follow Flow**: Navigate to **Settings** → toggle **Private Account** → request follow from another user.
4. **Search Functionality**: Use the search bar to search for posts, blogs, and usernames.
5. **CORS Check**: In browser DevTools (`F12`), check Network tab headers to confirm `access-control-allow-origin` matches your Vercel domain.
6. **SSL Enforcement**: Confirm both frontend and backend URLs are strictly served over `https://`.

---

## 🆘 Troubleshooting Common Deployment Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **CORS error in browser console** | `ALLOWED_ORIGINS` in backend does not match frontend domain | Check Render environment variables; ensure no trailing slash in `https://your-app.vercel.app`. |
| **Database connection timeout** | Neon connection string missing SSL or pooled endpoint | Use the pooled connection string ending with `?sslmode=require`. |
| **Redis connection error** | Missing TLS protocol | Ensure `REDIS_URL` begins with `rediss://` (with double `s`). |
| **Backend cold start delay** | Render free tier sleeps after 15 min of inactivity | The first request after sleep takes ~30-45 seconds to wake up. This is normal on free tiers. You can use a free uptime monitor (e.g. Cron-job.org or UptimeRobot) to ping `/health` every 14 minutes. |
