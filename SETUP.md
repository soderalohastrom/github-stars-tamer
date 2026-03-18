# Setup Guide - GitHub Stars Organizer

A comprehensive guide to set up the GitHub Stars Organizer development environment and deploy the application.

## Quick Start

For experienced developers who want to get started quickly:

```bash
# 1. Clone and install dependencies
git clone <repository-url>
cd github-stars-organizer
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Convex and Clerk keys

# 3. Start Convex backend
npx convex dev

# 4. Start Expo development server
npm start
```

## Detailed Setup

### 1. Prerequisites

#### System Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (or yarn/pnpm equivalent)
- **Git**: Latest version
- **Expo CLI**: `npm install -g @expo/cli`

#### Development Tools
- **iOS Development** (macOS only):
  - Xcode 14.0 or later
  - iOS Simulator
  - CocoaPods: `sudo gem install cocoapods`

- **Android Development**:
  - Android Studio with SDK 33+
  - Android Virtual Device (AVD)
  - Java Development Kit (JDK) 11 or 17

#### Accounts Setup
1. **Convex Account**: Sign up at [convex.dev](https://convex.dev)
2. **Clerk Account**: Sign up at [clerk.com](https://clerk.com)
3. **GitHub Account**: Required for OAuth setup
4. **Expo Account**: Sign up at [expo.dev](https://expo.dev)

### 2. Project Setup

#### Clone Repository
```bash
git clone <repository-url>
cd github-stars-organizer
```

#### Install Dependencies
```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

#### Verify Expo CLI
```bash
# Check Expo CLI version
npx expo --version

# Login to Expo (optional for development)
npx expo login
```

### 3. Backend Setup (Convex)

#### Create Convex Project
1. **Initialize Convex:**
   ```bash
   npx convex dev
   ```
   
   This will:
   - Prompt you to create a new Convex project
   - Deploy your functions and schema
   - Generate your deployment URL

2. **Get Convex URL:**
   - Copy the deployment URL from the terminal output
   - Format: `https://your-deployment-name.convex.cloud`

#### Convex Dashboard
1. Visit [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Explore the data browser, function logs, and settings

### 4. Authentication Setup (Clerk)

#### Create Clerk Application
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Click "Create Application"
3. Choose "React Native" as the framework
4. Copy your publishable key

#### Configure GitHub OAuth
1. In Clerk Dashboard, go to "User & Authentication" → "Social Connections"
2. Enable GitHub:
   - Click "GitHub" and toggle it on
   - Add redirect URLs:
     ```
     exp://localhost:8081
     http://localhost:8081
     com.yourcompany.githubstarsorganizer://oauth-callback
     ```
3. Configure OAuth Scopes:
   - Go to GitHub OAuth settings
   - Add required scopes: `public_repo`, `read:user`

#### GitHub OAuth Application Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details:
   ```
   Application name: GitHub Stars Organizer
   Homepage URL: http://localhost:3000
   Authorization callback URL: https://your-clerk-app.clerk.accounts.dev/v1/oauth_callback
   ```
4. Copy Client ID and Client Secret to Clerk

### 5. Environment Configuration

#### Create Environment File
```bash
cp .env.example .env
```

#### Configure .env
```env
# Convex Backend
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk Authentication  
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Development Configuration
DEBUG=1
EXPO_PUBLIC_APP_ENV=development
```

#### Environment Variables Explanation
- `EXPO_PUBLIC_CONVEX_URL`: Your Convex deployment URL
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key (starts with `pk_test_`)
- `DEBUG`: Enable debug logging in development
- `EXPO_PUBLIC_APP_ENV`: Current environment (development/production)

### 6. Development Server Setup

#### Start Convex Development Server
```bash
# In first terminal
npx convex dev
```

This provides:
- Real-time function updates
- Database schema deployment
- Function logs and debugging
- Development dashboard access

#### Start Expo Development Server
```bash
# In second terminal
npm start
```

Options:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Press `w` for web development
- Scan QR code for physical device testing

### 7. Testing Setup

#### iOS Simulator Testing
```bash
# Start iOS simulator directly
npm run ios

# Or use Expo CLI
npx expo run:ios
```

#### Android Emulator Testing
```bash
# Ensure Android emulator is running
emulator -avd Your_AVD_Name

# Start Android app
npm run android

# Or use Expo CLI
npx expo run:android
```

#### Physical Device Testing
1. Install Expo Go app on your device
2. Scan QR code from development server
3. Ensure device and computer are on same network

### 8. Development Tools Configuration

#### VS Code Extensions (Recommended)
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "expo.vscode-expo-tools"
  ]
}
```

#### Flipper Setup (Optional)
1. Install [Flipper](https://fbflipper.com/)
2. Enable React DevTools plugin
3. Connect to development builds for debugging

### 9. Verification Steps

#### Backend Verification
1. **Convex Functions:**
   ```bash
   # Check if functions are deployed
   npx convex dashboard
   ```
   - Verify all functions appear in dashboard
   - Test database queries work correctly

2. **Clerk Authentication:**
   - Test GitHub OAuth flow in app
   - Verify user creation in Clerk dashboard
   - Check token storage and retrieval

#### Frontend Verification
1. **App Launch:**
   - App starts without errors
   - Welcome screen displays correctly
   - Navigation between screens works

2. **Authentication Flow:**
   - GitHub sign-in redirects properly
   - User profile loads after authentication
   - Logout functionality works

3. **Core Features:**
   - Repository sync functionality
   - Category creation and management
   - Search and filtering features

### 10. Common Setup Issues

#### Convex Connection Issues
```bash
# Clear Convex cache
rm -rf .convex
npx convex dev --clear-cache

# Verify deployment
npx convex dashboard
```

#### Clerk Authentication Problems
```bash
# Clear Expo cache
npx expo r -c

# Verify Clerk configuration
# Check publishable key format (should start with pk_test_ or pk_live_)
```

#### Metro/Expo Issues
```bash
# Clear all caches
npx expo r -c
npm start -- --clear

# Reset Metro bundler
npx react-native start --reset-cache
```

#### iOS/Android Build Issues
```bash
# iOS: Clear Xcode cache
rm -rf ~/Library/Developer/Xcode/DerivedData

# Android: Clean Gradle cache
cd android && ./gradlew clean && cd ..

# Reinstall CocoaPods (iOS)
cd ios && rm -rf Pods && pod install && cd ..
```

### 11. Development Workflow

#### Daily Development
1. **Start Development Servers:**
   ```bash
   # Terminal 1: Convex backend
   npx convex dev
   
   # Terminal 2: Expo frontend
   npm start
   ```

2. **Code Changes:**
   - Frontend changes hot-reload automatically
   - Convex functions deploy automatically on save
   - Database schema changes require confirmation

3. **Testing:**
   - Test on multiple device sizes
   - Verify both iOS and Android compatibility
   - Test authentication flows regularly

#### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and test
# ...

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### 12. Next Steps

After successful setup:

1. **Explore the Codebase:**
   - Review project structure in README.md
   - Understand Convex schema and functions
   - Examine React Native components

2. **Customize the App:**
   - Update branding and colors
   - Modify app icons and splash screen
   - Add additional features or categories

3. **Prepare for Deployment:**
   - Review DEPLOYMENT.md guide
   - Set up production Convex and Clerk instances
   - Configure app store accounts

### 13. Getting Help

#### Documentation Resources
- [Expo Documentation](https://docs.expo.dev/)
- [Convex Documentation](https://docs.convex.dev/)
- [Clerk Documentation](https://clerk.com/docs)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)

#### Community Support
- [Expo Discord](https://chat.expo.dev/)
- [Convex Discord](https://convex.dev/community)
- [Clerk Discord](https://discord.com/invite/b5rXHjAg7A)
- [React Native Community](https://reactnative.dev/help)

#### Troubleshooting
1. Check error logs in terminal and device console
2. Verify all environment variables are set correctly
3. Ensure all services (Convex, Clerk) are properly configured
4. Test authentication flow step by step
5. Create GitHub issues for persistent problems

---

**Setup Complete!** 🎉

Your development environment is now ready. Start the development servers and begin building your GitHub Stars Organizer app!
