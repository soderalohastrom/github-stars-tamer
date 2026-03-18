# GitHub Stars Organizer

A React Native Expo Router app for organizing GitHub starred repositories into custom categories and subcategories.

## Features

### Core Functionality
- 📊 **Advanced Organization**: Create custom categories and subcategories with unlimited nesting depth
- 🔍 **Smart Search**: Filter repositories by language, topics, stars count, and custom tags
- 📱 **Offline Access**: Browse and organize repositories even without internet connection
- 🔄 **Real-time Sync**: Automatically sync starred repositories across all devices
- 🎨 **Visual Organization**: Color coding and icons for better visual categorization

### User Experience
- 🎨 **Modern UI**: Clean, intuitive interface with dark/light theme support
- ⚡ **Drag & Drop**: Reorganize repositories with intuitive drag and drop gestures
- 🔊 **Haptic Feedback**: Enhanced interaction with tactile responses
- 📊 **Statistics Dashboard**: Track your repository collection with detailed analytics
- 🎯 **Smart Suggestions**: AI-powered categorization suggestions based on repository topics

### Technical Features
- 🔒 **Secure Authentication**: GitHub OAuth via Clerk with secure token storage
- 💾 **Real-time Database**: Convex backend for instant data synchronization
- ⚡ **Performance Optimized**: Efficient caching and offline-first architecture
- 📱 **Cross-platform**: Native iOS and Android experience with single codebase

## Tech Stack

### Frontend
- **React Native**: Cross-platform mobile development
- **Expo Router**: File-based routing with TypeScript support
- **TypeScript**: Type-safe development
- **React Native Reanimated**: Smooth animations and gestures
- **React Native Gesture Handler**: Advanced touch interactions
- **Expo Haptics**: Tactile feedback
- **Zustand**: Lightweight state management

### Backend
- **Convex**: Real-time reactive database
- **Clerk**: Authentication and user management
- **GitHub API**: Repository data synchronization

### Authentication & Security
- **Clerk Auth**: GitHub OAuth integration
- **Expo Secure Store**: Encrypted credential storage
- **OAuth 2.0 with PKCE**: Enhanced mobile security

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (macOS) or Android emulator
- Convex account and project
- Clerk account and application

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd github-stars-organizer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file based on `.env.example`:
   ```env
   EXPO_PUBLIC_CONVEX_URL=https://your-convex-deployment.convex.cloud
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-key
   ```

4. **Convex Setup:**
   ```bash
   npx convex dev
   ```
   This will:
   - Create your Convex project
   - Deploy the database schema
   - Set up real-time functions

5. **Clerk Configuration:**
   - Create a Clerk application at [clerk.com](https://clerk.com)
   - Enable GitHub OAuth provider
   - Add redirect URLs for your Expo app
   - Configure OAuth scopes: `public_repo` and `read:user`

### Development

1. **Start Expo development server:**
   ```bash
   npm start
   ```

2. **Run on simulators:**
   ```bash
   # iOS Simulator
   npm run ios
   
   # Android Emulator
   npm run android
   
   # Web (for testing)
   npm run web
   ```

3. **Convex development:**
   In a separate terminal:
   ```bash
   npm run convex:dev
   ```

## Project Structure

```
github-stars-organizer/
├── app/                      # Expo Router app directory
│   ├── (auth)/               # Authentication screens
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/               # Main tab navigation
│   │   ├── index.tsx        # Repositories screen
│   │   ├── categories.tsx   # Categories management
│   │   ├── search.tsx       # Advanced search
│   │   ├── sync.tsx         # Sync management
│   │   └── profile.tsx      # User profile
│   ├── _layout.tsx           # Root layout with providers
│   └── index.tsx             # App entry point
│
├── src/                     # Source code
│   └── components/          # Reusable React components
│       ├── RepositoryCard.tsx
│       ├── CategoryCard.tsx
│       ├── LoadingSpinner.tsx
│       └── ...
│
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── users.ts             # User management
│   ├── categories.ts        # Categories CRUD
│   ├── repositories.ts      # Repository management
│   └── sync.ts              # GitHub API integration
│
└── assets/                  # Static assets
    ├── icon.png
    ├── splash.png
    └── adaptive-icon.png
```

## Key Features Implementation

### Real-time Synchronization
The app uses Convex for real-time data synchronization:
- **Reactive Queries**: UI automatically updates when data changes
- **Optimistic Updates**: Immediate UI feedback with server reconciliation
- **Offline Support**: Local caching with sync when connection restores

### GitHub API Integration
Secure and efficient GitHub API integration:
- **OAuth 2.0 + PKCE**: Enhanced security for mobile OAuth flows
- **Rate Limiting**: Intelligent handling of GitHub's API rate limits
- **Incremental Sync**: Efficient updates to minimize API calls
- **Token Security**: Encrypted storage using Expo Secure Store

### Advanced Categorization
Flexible organization system:
- **Nested Categories**: Unlimited depth for complex organization
- **Visual Hierarchy**: Color coding and icons for better visualization
- **Drag & Drop**: Intuitive repository organization
- **Smart Suggestions**: Auto-categorization based on repository metadata

### Search and Filtering
Powerful discovery features:
- **Multi-dimensional Search**: Filter by language, topics, stars, dates
- **Real-time Results**: Instant search as you type
- **Saved Searches**: Quick access to common filters
- **Advanced Filters**: Complex queries with multiple criteria

## Deployment

### Production Build

1. **Configure app.json** with your production settings:
   ```json
   {
     "expo": {
       "name": "GitHub Stars Organizer",
       "slug": "github-stars-organizer",
       "ios": {
         "bundleIdentifier": "com.yourcompany.githubstarsorganizer"
       },
       "android": {
         "package": "com.yourcompany.githubstarsorganizer"
       }
     }
   }
   ```

2. **Deploy Convex to production:**
   ```bash
   npm run convex:deploy
   ```

3. **Build for app stores:**
   ```bash
   # iOS App Store
   npm run build:ios
   
   # Google Play Store
   npm run build:android
   
   # Both platforms
   npm run build:all
   ```

4. **Submit to stores:**
   ```bash
   # iOS App Store
   npm run submit:ios
   
   # Google Play Store
   npm run submit:android
   ```

### Environment Configuration

**Production Environment Variables:**
```env
EXPO_PUBLIC_CONVEX_URL=https://your-prod-deployment.convex.cloud
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your-production-key
```

**Clerk Production Setup:**
- Configure production OAuth redirect URLs
- Enable GitHub OAuth in production
- Set up proper domain verification

## Security Considerations

### Authentication
- OAuth 2.0 with PKCE for enhanced mobile security
- Secure token storage using device keychain/keystore
- Automatic token refresh and rotation
- Session management with proper expiration

### Data Protection
- All sensitive data encrypted at rest
- TLS encryption for all network communications
- Minimal data collection and storage
- Secure API credential management

### Privacy
- No tracking or analytics without user consent
- Local-first data storage
- Transparent data usage policies
- User control over data synchronization

## Performance Optimization

### Mobile Performance
- **Lazy Loading**: Components loaded on demand
- **Virtual Lists**: Efficient rendering of large repository lists
- **Image Optimization**: Compressed and cached repository avatars
- **Bundle Splitting**: Smaller initial app size

### Network Efficiency
- **Request Batching**: Multiple operations in single API calls
- **Smart Caching**: Intelligent cache invalidation strategies
- **Offline Support**: Full functionality without network
- **Rate Limit Management**: Efficient API usage patterns

### Database Optimization
- **Indexed Queries**: Fast searches across large datasets
- **Real-time Updates**: Minimal data transfer for live updates
- **Optimistic Updates**: Immediate UI feedback
- **Data Denormalization**: Optimized for read performance

## Contributing

### Development Guidelines
1. **Code Style**: Follow TypeScript and React Native best practices
2. **Testing**: Add tests for new features and bug fixes
3. **Documentation**: Update README and inline documentation
4. **Performance**: Consider mobile performance in all changes

### Contribution Process
1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Submit a pull request with detailed description

## Troubleshooting

### Common Issues

**Convex Connection Issues:**
```bash
# Clear Convex cache
npm run convex:dev -- --clear-cache

# Verify environment variables
echo $EXPO_PUBLIC_CONVEX_URL
```

**Authentication Problems:**
```bash
# Clear Clerk cache
expo r -c

# Verify OAuth configuration
# Check Clerk dashboard for correct redirect URLs
```

**Build Errors:**
```bash
# Clear all caches
npx expo install --fix
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Performance Issues
- Enable Flipper for debugging (development only)
- Use Expo Development Build for better performance testing
- Monitor bundle size with `npx expo bundle-analyzer`

## License

MIT License - see LICENSE file for details.

## Support

For questions and support:
- Create an issue in the GitHub repository
- Check the troubleshooting guide above
- Review Expo and React Native documentation

---

**Built with ❤️ using React Native, Expo, Convex, and Clerk**
