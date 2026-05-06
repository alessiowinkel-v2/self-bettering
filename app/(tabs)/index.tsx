import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function Today() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Today</Text>
      <Link href="/design" style={{ marginTop: 20, color: '#E8A24C' }}>
        → /design
      </Link>
    </View>
  );
}