# Netlify Deployment Guide

## Issue
Build failed with error: "Supabase environment variables are missing"

## Solution

### Step 1: Add Environment Variables to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Select your project
3. Navigate to: **Site configuration** → **Environment variables**
4. Click **Add a variable** or **Add environment variables**

### Step 2: Required Environment Variables

Add ALL of the following variables (copy values from `.env.local`):

#### Critical (Build will fail without these):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### Additional (Required for full functionality):
```
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
MAPBOX_PUBLIC_TOKEN
NEXT_PUBLIC_MAPBOX_TOKEN
R2_TOKEN_VALUE
R2_BUCKET_NAME
R2_ACCESS_KEY
R2_SECRET_KEY
R2_REGION
R2_ENDPOINT
R2_ACCOUNT_ID
R2_PUBLIC_BASE_URL
NEXT_PUBLIC_R2_PUBLIC_BASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_URL
NEXTAUTH_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

#### Important Notes:
- For `NEXTAUTH_URL`: Use your Netlify domain (e.g., `https://your-app.netlify.app`)
- For `NEXTAUTH_SECRET`: Generate a new secure secret for production (not the dev one)
  ```bash
  # Generate a secure secret:
  openssl rand -base64 32
  ```

### Step 3: Deploy

After adding environment variables:
1. Go to **Deploys** tab
2. Click **Trigger deploy**
3. Select **Deploy site**

Or push a new commit to trigger automatic deployment.

## Quick Reference: Environment Variables from .env.local

Here's a checklist of all variables you need to add:

- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] DATABASE_URL
- [ ] MAPBOX_PUBLIC_TOKEN
- [ ] NEXT_PUBLIC_MAPBOX_TOKEN
- [ ] R2_TOKEN_VALUE
- [ ] R2_BUCKET_NAME
- [ ] R2_ACCESS_KEY
- [ ] R2_SECRET_KEY
- [ ] R2_REGION
- [ ] R2_ENDPOINT
- [ ] R2_ACCOUNT_ID
- [ ] R2_PUBLIC_BASE_URL
- [ ] NEXT_PUBLIC_R2_PUBLIC_BASE_URL
- [ ] GOOGLE_CLIENT_ID
- [ ] GOOGLE_CLIENT_SECRET
- [ ] NEXTAUTH_URL (update for production)
- [ ] NEXTAUTH_SECRET (generate new for production)
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] RAZORPAY_WEBHOOK_SECRET

## Troubleshooting

If the build still fails:
1. Check that all environment variables are properly set
2. Ensure there are no typos in variable names
3. Make sure variable values don't have extra spaces
4. Check Netlify build logs for specific errors
5. Try clearing cache and retrying: **Deploys** → **Trigger deploy** → **Clear cache and deploy site**
