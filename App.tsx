import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './src/components/ui';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { I18nProvider, useI18n } from './src/i18n';
import AdminDashboard from './src/screens/admin/AdminDashboard';
import AdminRewards from './src/screens/admin/AdminRewards';
import AdminStudents from './src/screens/admin/AdminStudents';
import AdminVerify from './src/screens/admin/AdminVerify';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RewardsScreen from './src/screens/RewardsScreen';
import StatsScreen from './src/screens/StatsScreen';
import SubmitScreen from './src/screens/SubmitScreen';
import { C } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function useTabOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: C.primary,
    tabBarInactiveTintColor: '#9AAFA2',
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
    tabBarStyle: {
      position: 'absolute' as const, left: 12, right: 12, bottom: Math.max(insets.bottom, 10),
      height: 66, borderRadius: 24, borderTopWidth: 0, backgroundColor: C.white, paddingTop: 6, paddingBottom: 8,
      shadowColor: '#0B3B22', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
      marginHorizontal: Platform.OS === 'web' ? 12 : 0,
    },
    sceneStyle: { paddingBottom: 80 + insets.bottom, backgroundColor: C.bg },
  };
}

const tabIcon = (name: string, center = false) => ({ color, focused }: { color: string; focused: boolean }) => center
  ? <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginTop: -24, borderWidth: 4, borderColor: C.bg }}>
      <Icon name={name} color={C.white} size={26} />
    </View>
  : <Icon name={focused ? name : `${name}-outline`} color={color} size={24} />;

function StudentTabs() {
  const { t } = useI18n();
  const opts = useTabOptions();
  return (
    <Tab.Navigator screenOptions={opts}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tab.home'), tabBarIcon: tabIcon('home') }} />
      <Tab.Screen name="Submit" component={SubmitScreen} options={{ title: t('tab.submit'), tabBarIcon: tabIcon('recycle', true) }} />
      <Tab.Screen name="Leaders" component={LeaderboardScreen} options={{ title: t('tab.leaders'), tabBarIcon: tabIcon('trophy') }} />
      <Tab.Screen name="Rewards" component={RewardsScreen} options={{ title: t('tab.rewards'), tabBarIcon: tabIcon('gift') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab.profile'), tabBarIcon: tabIcon('account-circle') }} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  const { t } = useI18n();
  const opts = useTabOptions();
  return (
    <Tab.Navigator screenOptions={opts}>
      <Tab.Screen name="Dashboard" component={AdminDashboard} options={{ title: t('tab.dashboard'), tabBarIcon: tabIcon('view-dashboard') }} />
      <Tab.Screen name="Verify" component={AdminVerify} options={{ title: t('tab.verify'), tabBarIcon: tabIcon('check-decagram', true) }} />
      <Tab.Screen name="Leaders" component={LeaderboardScreen} options={{ title: t('tab.leaders'), tabBarIcon: tabIcon('trophy') }} />
      <Tab.Screen name="Students" component={AdminStudents} options={{ title: t('tab.students'), tabBarIcon: tabIcon('account-group') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tab.profile'), tabBarIcon: tabIcon('account-circle') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { session, profile, loading } = useAuth();
  if (loading || (session && !profile)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <Icon name="leaf" size={48} />
        <Text style={{ fontWeight: '900', color: C.primaryDark, marginTop: 8, letterSpacing: 1 }}>ECO POINT COLLEGE</Text>
        <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      {!session ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : profile?.role === 'admin' ? (
        <>
          <Stack.Screen name="AdminMain" component={AdminTabs} />
          <Stack.Screen name="AdminRewards" component={AdminRewards} options={{ presentation: 'modal' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={StudentTabs} />
          <Stack.Screen name="Stats" component={StatsScreen} options={{ presentation: 'modal' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: C.primary, background: C.bg } };

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <NavigationContainer theme={theme}>
            <StatusBar style="light" />
            <Root />
          </NavigationContainer>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
