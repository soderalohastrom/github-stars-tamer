import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  useColorScheme,
} from 'react-native';

interface UserAvatarProps {
  imageUrl?: string;
  name: string;
  size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  imageUrl,
  name,
  size = 40,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const getInitials = (fullName: string) => {
    const names = fullName.split(' ');
    const initials = names.map(name => name.charAt(0)).join('');
    return initials.substring(0, 2).toUpperCase();
  };

  const getBackgroundColor = (name: string) => {
    // Generate a consistent color based on the name
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#f97316', '#06b6d4', '#84cc16',
      '#f43f5e', '#6b7280'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const styles = StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: imageUrl ? 'transparent' : getBackgroundColor(name),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    image: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    initials: {
      fontSize: size * 0.4,
      fontWeight: '600',
      color: '#ffffff',
    },
  });

  return (
    <View style={styles.container}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <Text style={styles.initials}>{getInitials(name)}</Text>
      )}
    </View>
  );
};

export default UserAvatar;
