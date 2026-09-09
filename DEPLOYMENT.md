# BitWinner - Complete Setup & Deployment Guide

This guide covers everything from local development to production deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Google OAuth Setup](#google-oauth-setup)
4. [Running Locally](#running-locally)
5. [Production Deployment](#production-deployment)
6. [Deployment Options](#deployment-options)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **MongoDB** (v6 or higher)
   - **Option A: Local Installation**
     - Download: https://www.mongodb.com/try/download/community
   - **Option B: MongoDB Atlas (Cloud - Recommended for production)**
     - Sign up: https://www.mongodb.com/atlas
     - Free tier available

3. **Git** (optional, for version control)
   - Download: https://git-scm.com/

---

## Local Development Setup

### Step 1: Install Dependencies

Open terminal/command prompt in the project folder:

```bash
cd F:\1.Code\bitwinner
npm install
```

### Step 2: Configure Environment Variables

1. Copy the example environment file:

```bash
# Windows Command Prompt
copy .env.example .env

# Windows PowerShell
Copy-Item .env.example .env

# Mac/Linux
cp .env.example .env
```

2. Edit `.env` file with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection
# Local MongoDB:
MONGODB_URI=mongodb://localhost:27017/bitwinner
# OR MongoDB Atlas (replace with your connection string):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bitwinner

# JWT Secrets (CHANGE THESE! Use random strings)
# Generate at: https://randomkeygen.com/ (use 256-bit WEP Keys)
JWT_SECRET=change-this-to-a-random-64-character-string-for-security
JWT_REFRESH_SECRET=change-this-to-another-random-64-character-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth 2.0 (see Google OAuth Setup section)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration (optional - for email verification)
# Using Gmail:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
EMAIL_FROM=BitWinner <noreply@bitwinner.com>

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Game Configuration
TICKET_PRICE=1
HOUSE_FEE=0.05
RACE_DURATION=10000
```

### Step 3: Start MongoDB (Local Installation)

**Windows:**
```bash
# If installed as service, it starts automatically
# Or start manually:
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
```

**Mac:**
```bash
brew services start mongodb-community
# Or manually:
mongod --dbpath /usr/local/var/mongodb
```

**Linux:**
```bash
sudo systemctl start mongod
# Or:
sudo service mongod start
```

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "BitWinner" → Click "Create"

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" → Click "Create"
3. Fill in:
   - App name: `BitWinner`
   - User support email: Your email
   - Developer contact: Your email
4. Click "Save and Continue"
5. Skip "Scopes" → Click "Save and Continue"
6. Skip "Test users" → Click "Save and Continue"

### Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: `BitWinner Web Client`
5. **Authorized JavaScript origins:**
   ```
   http://localhost:3000
   ```
   (Add your production URL later)

6. **Authorized redirect URIs:**
   ```
   http://localhost:3000
   ```

7. Click "Create"
8. Copy the **Client ID** and **Client Secret**

### Step 4: Update Configuration

1. Update `.env`:
```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```

2. Update `public/app.js` (line ~15):
```javascript
google.accounts.id.initialize({
  client_id: '123456789-abcdefg.apps.googleusercontent.com', // Your Client ID here
  callback: handleGoogleCredential,
  auto_select: false
});
```

---

## Running Locally

### Start the Server

```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

### Access the Application

Open your browser and go to:
```
http://localhost:3000
```

### Test the Application

1. **Create an account:**
   - Click "Sign Up"
   - Enter email, username, password
   - Or use "Sign in with Google"

2. **Place a bet:**
   - Select tickets for Red and/or Green team
   - Click "Place Bet"
   - Watch the 10-second race

3. **Check features:**
   - View profile (click username → Profile)
   - View transactions
   - Deposit more USDT (demo mode)

---

## Production Deployment

### Option 1: Railway (Easiest - Recommended)

[Railway](https://railway.app/) offers easy deployment with free tier.

#### Step 1: Prepare for Deployment

1. Create `Procfile` in project root:
```
web: node server.js
```

2. Update `package.json` engines:
```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app/) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub and select the repository
4. Railway auto-detects Node.js

#### Step 3: Add MongoDB

1. In Railway dashboard, click "New" → "Database" → "MongoDB"
2. Railway creates a MongoDB instance
3. Copy the connection string

#### Step 4: Configure Environment Variables

In Railway dashboard → Your project → Variables:

```
NODE_ENV=production
MONGODB_URI=mongodb://... (from Railway MongoDB)
JWT_SECRET=your-production-secret-key
JWT_REFRESH_SECRET=your-production-refresh-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=https://your-app.railway.app
```

#### Step 5: Update Google OAuth

Add your Railway URL to Google Cloud Console:
- Authorized JavaScript origins: `https://your-app.railway.app`
- Authorized redirect URIs: `https://your-app.railway.app`

---

### Option 2: Render

[Render](https://render.com/) offers free web services.

#### Step 1: Create Web Service

1. Go to [render.com](https://render.com/) and sign up
2. Click "New" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - Name: `bitwinner`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node server.js`

#### Step 2: Add MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free cluster
3. Get connection string
4. Add to Render environment variables

#### Step 3: Environment Variables

In Render dashboard → Environment:
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GOOGLE_CLIENT_ID=...
FRONTEND_URL=https://bitwinner.onrender.com
```

---

### Option 3: DigitalOcean / VPS

For more control, use a VPS.

#### Step 1: Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install MongoDB
# Follow: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx
```

#### Step 2: Deploy Application

```bash
# Clone repository
cd /var/www
git clone https://github.com/yourusername/bitwinner.git
cd bitwinner

# Install dependencies
npm install --production

# Create .env file
nano .env
# Add all environment variables

# Start with PM2
pm2 start server.js --name bitwinner
pm2 save
pm2 startup
```

#### Step 3: Configure Nginx

```bash
nano /etc/nginx/sites-available/bitwinner
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/bitwinner /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Setup SSL with Let's Encrypt
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

### Option 4: Docker Deployment

#### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

#### docker-compose.yml

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/bitwinner
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

#### Deploy with Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f app
```

---

## Production Checklist

Before going live, ensure:

- [ ] **Environment Variables**
  - [ ] Strong, unique JWT secrets (64+ characters)
  - [ ] `NODE_ENV=production`
  - [ ] Correct `FRONTEND_URL`

- [ ] **Security**
  - [ ] HTTPS enabled (SSL certificate)
  - [ ] Google OAuth URLs updated for production domain
  - [ ] Rate limiting configured

- [ ] **Database**
  - [ ] MongoDB connection string is production database
  - [ ] Database backups configured
  - [ ] Indexes created (automatic on first run)

- [ ] **Monitoring**
  - [ ] Error logging enabled
  - [ ] Uptime monitoring (e.g., UptimeRobot)
  - [ ] PM2 or similar process manager

---

## Troubleshooting

### MongoDB Connection Failed

```
Error: MongoServerSelectionError
```

**Solutions:**
1. Check if MongoDB is running: `mongod --version`
2. Verify connection string in `.env`
3. For Atlas: Check IP whitelist (allow 0.0.0.0/0 for testing)

### Google OAuth Not Working

```
Error: Invalid OAuth client
```

**Solutions:**
1. Verify Client ID matches in `.env` AND `public/app.js`
2. Check authorized origins include your URL
3. Clear browser cache and cookies

### Port Already in Use

```
Error: EADDRINUSE: address already in use :::3000
```

**Solutions:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### Socket.IO Connection Issues

**Solutions:**
1. Check CORS settings in server.js
2. Ensure WebSocket is not blocked by firewall
3. For Nginx, ensure WebSocket headers are proxied

### Email Not Sending

**Solutions:**
1. For Gmail: Enable 2FA and create App Password
2. Check SMTP credentials in `.env`
3. Check spam folder
4. Verify SMTP_HOST and SMTP_PORT

---

## Support

For issues:
1. Check the console for error messages
2. Check MongoDB connection
3. Verify all environment variables are set
4. Check the troubleshooting section above

---

## Quick Start Commands

```bash
# Install
npm install

# Development
npm run dev

# Production
npm start

# With PM2
pm2 start server.js --name bitwinner
pm2 logs bitwinner
pm2 restart bitwinner
```
