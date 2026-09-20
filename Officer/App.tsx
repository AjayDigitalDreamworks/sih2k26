import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { colors } from './src/theme/colors';
import { TopBar } from './src/components/TopBar';
import { BottomNavBar, OfficerTabName } from './src/components/BottomNavBar';
import { MobileContainer } from './src/components/MobileContainer';

import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { GisMapScreen } from './src/screens/GisMapScreen';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ReportHazardScreen } from './src/screens/ReportHazardScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { fieldOfficerApi } from './src/api/fieldOfficer';
import { subscribeToAlerts, subscribeToHazards } from './src/api/socket';

function AppContent() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [authStage, setAuthStage] = useState<'landing' | 'login' | 'app'>('landing');
  const [currentTab, setCurrentTab] = useState<OfficerTabName>('tasks');
  const [isReportingHazard, setIsReportingHazard] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedCoords, setSelectedCoords] = useState<string | undefined>(undefined);
  const [alertsCount, setAlertsCount] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated) {
      if (authStage === 'landing' || authStage === 'login') {
        setAuthStage('app');
      }
      fieldOfficerApi.getNearbyAlerts().then((data) => {
        if (Array.isArray(data)) setAlertsCount(data.length);
        const list = Array.isArray(data) ? data : ((data as any)?.hazards || (data as any)?.alerts || []);
        setAlertsCount(list.length);
      }).catch(() => {});
      const unsubAlerts = subscribeToAlerts(() => {
        setAlertsCount(c => c + 1);
      });
      const unsubHazards = subscribeToHazards(() => {
        setAlertsCount(c => c + 1);
      });
      return () => {
        unsubAlerts();
        unsubHazards();
      };
    } else if (!isLoading && (authStage === 'app' || authStage === 'login')) {
      setAuthStage('landing');
    }
  }, [isAuthenticated, isLoading]);

  const handleNavigateToGis = (coords?: string) => {
    setSelectedCoords(coords);
    setIsReportingHazard(false);
    setCurrentTab('gis');
  };

  const renderScreenContent = () => {
    if (isReportingHazard) {
      return (
        <ReportHazardScreen
          initialTask={selectedTask}
          onBack={() => {
            setIsReportingHazard(false);
            setSelectedTask(null);
          }}
          onSubmitSuccess={() => {
            setIsReportingHazard(false);
            setSelectedTask(null);
            setCurrentTab('tasks');
          }}
        />
      );
    }

    switch (currentTab) {
      case 'tasks':
        return (
          <TasksScreen
            onNavigateToGis={handleNavigateToGis}
            onVerifyGroundTruth={(task) => {
              setSelectedTask(task);
              setIsReportingHazard(true);
            }}
            onInspectCulvert={(task) => {
              setSelectedTask(task);
              if (task?.latitude && task?.longitude) {
                handleNavigateToGis(`${task.latitude},${task.longitude}`);
              } else {
                handleNavigateToGis();
              }
            }}
            onStartAudit={(task) => {
              setSelectedTask(task);
              setIsReportingHazard(true);
            }}
          />
        );
      case 'gis':
        return (
          <GisMapScreen
            initialCoords={selectedCoords}
            onNavigateSafeRoute={() => {}}
            onInspectAndVerify={(task) => {
              setSelectedTask(task);
              setIsReportingHazard(true);
            }}
            onOpenRadarFeed={() => {}}
          />
        );
      case 'alerts':
        return (
          <AlertsScreen
            onAcceptAndRoute={(alert) => {
              const coords = alert?.coordinates
                ? (typeof alert.coordinates === 'string'
                    ? alert.coordinates
                    : `${alert.coordinates.lat || alert.coordinates[0]},${alert.coordinates.lng || alert.coordinates[1]}`)
                : undefined;
              handleNavigateToGis(coords);
            }}
            onOpenSensorGraph={() => {}}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onSignOut={async () => {
              await logout();
              setAuthStage('landing');
              setCurrentTab('tasks');
              setIsReportingHazard(false);
            }}
            onEmergencySos={() => {
              setSelectedTask(null);
              setIsReportingHazard(true);
            }}
          />
        );
      default:
        return (
          <TasksScreen
            onNavigateToGis={handleNavigateToGis}
            onVerifyGroundTruth={(task) => {
              setSelectedTask(task);
              setIsReportingHazard(true);
            }}
          />
        );
    }
  };

  if (authStage === 'landing') {
    return (
      <MobileContainer>
        <LandingScreen
          onGetStarted={() => setAuthStage('login')}
          onSignIn={() => setAuthStage('login')}
        />
      </MobileContainer>
    );
  }

  if (authStage === 'login') {
    return (
      <MobileContainer>
        <LoginScreen
          onLoginSuccess={() => setAuthStage('app')}
          onBackToLanding={() => setAuthStage('landing')}
        />
      </MobileContainer>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={currentTab === 'tasks' && !isReportingHazard ? 'light' : 'dark'} />
      <MobileContainer>
        <View style={styles.appShell}>
          {!isReportingHazard && (
            <TopBar
              variant={currentTab === 'tasks' ? 'tasks' : 'default'}
              onProfilePress={() => setCurrentTab('profile')}
              onSosPress={() => {
                setSelectedTask(null);
                setIsReportingHazard(true);
              }}
              onRefreshPress={() => {
                fieldOfficerApi.getNearbyAlerts().then((data) => {
                  if (Array.isArray(data)) setAlertsCount(data.length);
                  const list = Array.isArray(data) ? data : ((data as any)?.hazards || (data as any)?.alerts || []);
                  setAlertsCount(list.length);
                }).catch(() => {});
              }}
              gpsAccuracy="\u00b10.4m"
              isLocked={true}
            />
          )}
          <View style={styles.screenContainer}>
            {renderScreenContent()}
          </View>
          {!isReportingHazard && (
            <BottomNavBar
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setIsReportingHazard(false);
                setSelectedTask(null);
                setCurrentTab(tab);
              }}
              onCenterActionPress={() => {
                setSelectedTask(null);
                setIsReportingHazard(true);
              }}
              alertsCount={alertsCount}
            />
          )}
        </View>
      </MobileContainer>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#071F15',
  },
  appShell: {
    flex: 1,
    backgroundColor: colors.background,
    flexDirection: 'column',
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
  },
  screenContainer: {
    flex: 1,
    position: 'relative',
  },
});
