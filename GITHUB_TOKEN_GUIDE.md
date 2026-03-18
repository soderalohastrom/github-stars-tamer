# GitHub Personal Access Token Setup Guide

This app requires a GitHub Personal Access Token to sync your starred repositories. Here's why and how to set it up:

## Why Two Types of Authentication?

1. **Clerk OAuth (GitHub)** - Authenticates you with the app using your GitHub identity
2. **Personal Access Token** - Gives the app permission to access your GitHub starred repositories

This dual approach provides better security and more granular control over what the app can access.

## Creating a Personal Access Token

### Step 1: Go to GitHub Settings
1. Visit: https://github.com/settings/tokens/new
2. Or navigate manually: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

### Step 2: Configure Your Token
1. **Token name**: `GitHub Stars Organizer`
2. **Expiration**: Choose your preferred expiration (90 days recommended)
3. **Select scopes** (permissions):
   - ✅ `public_repo` - Access public repositories
   - ✅ `user:email` - Read your email address

### Step 3: Generate and Copy
1. Click "Generate token"
2. **Important**: Copy the token immediately - you won't see it again!
3. The token will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Using the Token in the App

1. Open the app and go to **Profile** tab
2. Find the **GitHub Connection** section
3. Tap **"Connect GitHub"**
4. Paste your token in the input field
5. Tap **"Connect"**

The app will validate your token and show your GitHub username when connected.

## Security Notes

- ✅ **Secure Storage**: Your token is stored securely on your device using Expo SecureStore
- ✅ **Local Only**: The token never leaves your device except for direct GitHub API calls
- ✅ **Limited Scope**: Only has access to public repositories and email
- ✅ **Revocable**: You can revoke the token anytime at https://github.com/settings/tokens

## Troubleshooting

### "Invalid Token" Error
- Double-check you copied the entire token
- Ensure the token has the correct scopes (`public_repo`, `user:email`)
- Check if the token has expired

### "GitHub API Rate Limit" Error
- GitHub limits API calls to 5,000 per hour for authenticated requests
- The app automatically handles rate limiting
- Try syncing again after the limit resets

### Token Expired
- Create a new token following the steps above
- Replace the old token in the app

## Syncing Your Repositories

Once connected:
1. Go to the **Sync** tab
2. Tap **"Full Sync"** for the first time
3. Use **"Quick Sync"** for updates
4. The app will organize your starred repos into categories

## Managing Your Token

### To Update Your Token:
1. Create a new token on GitHub
2. In the app, go to Profile → GitHub Connection
3. Tap "Disconnect" then "Connect GitHub"
4. Enter your new token

### To Revoke Access:
1. Go to https://github.com/settings/tokens
2. Find "GitHub Stars Organizer" token
3. Click "Delete"
4. In the app, the connection will show as disconnected

---

**Need Help?** Check the [GitHub Personal Access Token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for more details.