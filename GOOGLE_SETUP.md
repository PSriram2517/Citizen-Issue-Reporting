# Google OAuth 2.0 Setup Guide

To enable Google Sign-In authentication for your Citizen Issue Reporting website, follow these steps:

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name: "Citizen Issue Reporting"
4. Click "Create"
5. Wait for the project to be created

## Step 2: Enable Google+ API

1. In the Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, click "Configure OAuth Consent Screen"
4. Select "External" and click "Create"
5. Fill in the form:
   - App name: "Citizen Issue Reporting"
   - User support email: your@email.com
   - Developer contact: your@email.com
6. Click "Save and Continue" through all sections
7. Go back to "Credentials"
8. Click "Create Credentials" → "OAuth client ID"
9. Select "Web application"
10. Add Authorized JavaScript origins:
    - `http://localhost:3000`
    - Your production domain (e.g., `https://yourdomain.com`)
11. Add Authorized redirect URIs:
    - `http://localhost:3000`
    - Your production domain
12. Click "Create"
13. Copy your **Client ID**

## Step 4: Update Your Application

1. Open `public/index.html`
2. Find this line:
   ```html
   data-client_id="YOUR_GOOGLE_CLIENT_ID"
   ```
3. Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID from Step 3
4. Save the file

## Step 5: Install JWT dependency (Optional for production)

```bash
npm install jsonwebtoken
```

## Step 6: Run Your Server

```bash
node server.js
```

Visit `http://localhost:3000` and you should see the Google Sign-In button!

## Gmail Configuration (Optional)

To enable email confirmations, also set up Gmail in your `.env` file:

```
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

See `public/admin.html` for Gmail App Password instructions.
