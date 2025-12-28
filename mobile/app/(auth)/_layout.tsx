import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#6366f1',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Logowanie',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Rejestracja',
        }}
      />
    </Stack>
  );
}
