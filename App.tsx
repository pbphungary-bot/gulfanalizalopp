import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getProfile } from './src/db';
import type { Profile } from './src/domain/types';
import type { RootStackParams, TabParams } from './src/navigation';
import { AddCourse } from './src/screens/AddCourse';
import { Coach } from './src/screens/Coach';
import { Fitness } from './src/screens/Fitness';
import { DrillScreen } from './src/screens/Drill';
import { Home } from './src/screens/Home';
import { MyGame } from './src/screens/MyGame';
import { Onboarding } from './src/screens/Onboarding';
import { Play } from './src/screens/Play';
import { RoundScreen } from './src/screens/Round';
import { RoundReview } from './src/screens/RoundReview';
import { Session } from './src/screens/Session';
import { I18nProvider, useI18n } from './src/i18n';
import { ThemeProvider, useTheme } from './src/theme';

const Tab = createBottomTabNavigator<TabParams>();
const Stack = createNativeStackNavigator<RootStackParams>();

const GLYPH: Record<keyof TabParams, string> = { Home: '◉', Coach: '◈', Play: '⛳', Fitness: '⚡', MyGame: '▥' };

function Tabs({ profile }: { profile: Profile }) {
  const { c } = useTheme();
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { minHeight: 62, backgroundColor: c.card, borderTopColor: c.line },
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>{GLYPH[route.name]}</Text>,
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" options={{ title: t('tab.home') }}>{() => <Home profile={profile} />}</Tab.Screen>
      <Tab.Screen name="Coach" options={{ title: t('tab.coach') }}>{() => <Coach profile={profile} />}</Tab.Screen>
      <Tab.Screen name="Play" component={Play} options={{ title: t('tab.play') }} />
      <Tab.Screen name="Fitness" component={Fitness} options={{ title: t('tab.fitness') }} />
      <Tab.Screen name="MyGame" component={MyGame} options={{ title: t('tab.mygame') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { c, isDark } = useTheme();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .finally(() => setReady(true));
  }, []);

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: c.bg, card: c.bg, text: c.text, border: c.line, primary: c.accent } };
  }, [c, isDark]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!profile ? (
        <Onboarding onDone={setProfile} />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text, headerShadowVisible: false }}>
            <Stack.Screen name="Tabs" options={{ headerShown: false }}>
              {() => <Tabs profile={profile} />}
            </Stack.Screen>
            <Stack.Screen name="Round" component={RoundScreen} options={{ title: t('nav.round') }} />
            <Stack.Screen name="RoundReview" component={RoundReview} options={{ title: t('nav.review') }} />
            <Stack.Screen name="Session" component={Session} options={{ title: t('nav.session') }} />
            <Stack.Screen name="AddCourse" component={AddCourse} options={{ title: t('nav.addCourse') }} />
            <Stack.Screen name="Drill" component={DrillScreen} options={{ title: t('nav.drill') }} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Root />
      </I18nProvider>
    </ThemeProvider>
  );
}
