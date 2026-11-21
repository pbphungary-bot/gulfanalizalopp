import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getProfile } from './src/db';
import type { Profile } from './src/domain/types';
import type { RootStackParams, TabParams } from './src/navigation';
import { Coach } from './src/screens/Coach';
import { DrillScreen } from './src/screens/Drill';
import { Home } from './src/screens/Home';
import { MyGame } from './src/screens/MyGame';
import { Onboarding } from './src/screens/Onboarding';
import { Play } from './src/screens/Play';
import { RoundScreen } from './src/screens/Round';
import { RoundReview } from './src/screens/RoundReview';
import { Session } from './src/screens/Session';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator<TabParams>();
const Stack = createNativeStackNavigator<RootStackParams>();

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary } };

function Tabs({ profile }: { profile: Profile }) {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarLabelStyle: { fontSize: 13 }, tabBarStyle: { minHeight: 60 } }}>
      <Tab.Screen name="Home">{() => <Home name={profile.name} />}</Tab.Screen>
      <Tab.Screen name="Coach">{() => <Coach profile={profile} />}</Tab.Screen>
      <Tab.Screen name="Play" component={Play} />
      <Tab.Screen name="MyGame" component={MyGame} options={{ title: 'My Game' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!profile ? (
        <Onboarding onDone={setProfile} />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator>
            <Stack.Screen name="Tabs" options={{ headerShown: false }}>
              {() => <Tabs profile={profile} />}
            </Stack.Screen>
            <Stack.Screen name="Round" component={RoundScreen} options={{ title: 'Round', headerBackVisible: true }} />
            <Stack.Screen name="RoundReview" component={RoundReview} options={{ title: 'Round review' }} />
            <Stack.Screen name="Session" component={Session} options={{ title: 'Session' }} />
            <Stack.Screen name="Drill" component={DrillScreen} options={{ title: 'Log drill' }} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
