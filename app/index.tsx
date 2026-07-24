import { Redirect } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#FFD84D" />
        <Text style={styles.loadingLabel}>OPENING YOUR SHELF</Text>
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#10100F',
  },
  loadingLabel: {
    color: '#AAA59B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
});
