# Testing Guide

## Quick Start Testing

### 1. Verify Core Package
```bash
cd packages/core
npm run build
```
This should complete without errors and create the `dist/` directory.

### 2. Check Dependencies
```bash
cd mobile_app
npm install
```
Make sure all packages are installed correctly.

### 3. Set Up Environment Variables
Create a `.env` file in `mobile_app/` directory:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Start the App
```bash
cd mobile_app
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## What to Test

### ✅ Currently Working

1. **App Navigation**
   - App should start and show login screen if not authenticated
   - Navigation structure with expo-router should work

2. **Login Screen** (`app/(auth)/login.tsx`)
   - Should display "BOOK" title with icon
   - "Sign in with Google" button should be visible
   - Button should be clickable (will attempt OAuth flow)

3. **Home Screen** (`app/(tabs)/index.tsx`)
   - Should show "BOOKS" header
   - Should display user email if authenticated
   - Should show test box with authentication status

4. **Auth Flow**
   - AuthContext should manage session state
   - Should redirect between auth and tabs based on login status

### 🔧 Known Issues / TODO

1. **OAuth Redirect**
   - OAuth callback handling may need adjustment
   - Deep linking needs to be configured in Supabase dashboard
   - Add redirect URL: `bookreview://` (for development)

2. **Supabase Connection**
   - If environment variables are missing, app will warn but continue
   - Actual API calls will fail without valid credentials

3. **Core Package Import**
   - TypeScript should resolve `@book-review/core` imports
   - If errors occur, rebuild core package

## Manual Testing Checklist

- [ ] App starts without errors
- [ ] Login screen displays correctly
- [ ] Can tap "Sign in with Google" button (may fail without proper OAuth setup)
- [ ] Home screen shows when authenticated
- [ ] Navigation between screens works
- [ ] No TypeScript errors in console
- [ ] No runtime errors

## Expected Behavior

1. **First Launch (Not Authenticated)**
   - Shows login screen
   - Can tap Google sign-in button
   - After OAuth flow, should redirect to home

2. **After Authentication**
   - Shows home screen with "BOOKS" header
   - Displays user email in header
   - Shows test status box confirming authentication

3. **Navigation**
   - Bottom tabs visible (Home, Add Book)
   - Can switch between tabs

## Troubleshooting

### "Cannot find module '@book-review/core'"
```bash
cd packages/core && npm run build
cd ../../mobile_app && npm install
```

### "Supabase credentials not found"
- Create `.env` file in `mobile_app/` directory
- Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### OAuth not working
- Check Supabase dashboard → Authentication → URL Configuration
- Add redirect URL: `bookreview://` 
- For development, may need to use `exp://` scheme instead

### Build errors
- Clear cache: `npx expo start -c`
- Rebuild core: `cd packages/core && npm run build`
- Reinstall dependencies: `rm -rf node_modules && npm install`
