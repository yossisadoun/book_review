# Debug OAuth Redirect Issue

If you're still being redirected to the GitHub URL instead of the mobile app, follow these steps:

## Step 1: Check Console Logs

When you tap "Sign in with Google", check the terminal/console. You should see:

```
🔐 Mobile OAuth Sign-In:
  Redirect URL: bookreview://auth/callback
  ⚠️  Make sure this URL is added to Supabase Dashboard...
🔐 Opening OAuth URL: https://...
🔐 Expected redirect to: bookreview://auth/callback
```

**If the redirect URL shows a web URL instead of `bookreview://`, that's the problem.**

## Step 2: Verify Supabase Configuration

1. Go to Supabase Dashboard
2. Authentication → URL Configuration
3. Check **Redirect URLs** list
4. Make sure `bookreview://auth/callback` is there (exact match, case-sensitive)

## Step 3: Check What URL Supabase is Generating

The OAuth URL that Supabase generates should include your redirect URL. You can check this:

1. Look at the console log: `🔐 Opening OAuth URL: ...`
2. Copy that URL and paste it in a text editor
3. Look for `redirect_to=` parameter
4. It should be URL-encoded and point to `bookreview://auth/callback`

If it shows a web URL there, Supabase might be ignoring your redirectTo parameter.

## Step 4: Verify app.json Scheme

Check that `app.json` has:
```json
{
  "expo": {
    "scheme": "bookreview"
  }
}
```

## Step 5: Test Deep Linking

Test if deep linking works at all:

1. On your device, try opening: `bookreview://auth/callback`
2. If the app doesn't open, deep linking isn't configured correctly
3. In Expo Go, deep linking might work differently

## Common Issues:

### Issue: Redirect URL in logs is a web URL
**Solution:** The `Linking.createURL()` might be generating a web URL. Check if you're running in web mode or if there's an environment variable affecting it.

### Issue: Supabase redirects to web URL
**Solution:** Make sure `skipBrowserRedirect: true` is set (it is now). Also verify the redirect URL is in Supabase's allowed list.

### Issue: Works in development build but not Expo Go
**Solution:** Expo Go has limitations with deep linking. Consider creating a development build: `npx expo run:ios` or `npx expo run:android`

## Quick Test

Run this in your terminal to see what URL is being generated:

```bash
cd mobile_app
node -e "const Linking = require('expo-linking').default; console.log(Linking.createURL('/auth/callback'));"
```

This should output: `bookreview://auth/callback`
