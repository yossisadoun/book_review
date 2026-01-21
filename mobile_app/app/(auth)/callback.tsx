// OAuth callback handler for mobile app

import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Wait a moment for the URL to be fully processed
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if we have tokens in the URL
        const accessToken = params.access_token as string | undefined;
        const refreshToken = params.refresh_token as string | undefined;

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            router.replace('/(auth)/login');
            return;
          }

          // Success - redirect to home
          router.replace('/(tabs)');
          return;
        }

        // If no tokens in params, try to get session (Supabase might have handled it)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          router.replace('/(auth)/login');
          return;
        }

        if (session) {
          router.replace('/(tabs)');
        } else {
          // No session found, redirect to login
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Error in auth callback:', error);
        router.replace('/(auth)/login');
      }
    }

    handleCallback();
  }, [params, router]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.slate[50], colors.white]}
        style={styles.gradientBackground}
      >
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.blue[600]} />
          <Text style={styles.text}>Completing sign in...</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: typography.fontSize.base,
    color: colors.slate[500],
  },
});
