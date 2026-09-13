import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ClipboardCheck, Map, Plus, Bell, User } from 'lucide-react-native';
import { colors } from '../theme/colors';

export type OfficerTabName = 'tasks' | 'gis' | 'alerts' | 'profile';

interface BottomNavBarProps {
  currentTab: OfficerTabName;
  onSelectTab: (tab: OfficerTabName) => void;
  onCenterActionPress: () => void;
  alertsCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onSelectTab,
  onCenterActionPress,
  alertsCount = 5,
}) => {
  return (
    <View style={styles.outerContainer}>
      <View style={styles.navBar}>
        {/* Tab 1: Tasks */}
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.75}
          onPress={() => onSelectTab('tasks')}
        >
          <ClipboardCheck
            size={22}
            color={currentTab === 'tasks' ? colors.primaryDark : colors.textMuted}
            strokeWidth={currentTab === 'tasks' ? 2.5 : 1.8}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'tasks' && styles.navLabelActive,
            ]}
          >
            Tasks
          </Text>
        </TouchableOpacity>

        {/* Tab 2: GIS Map */}
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.75}
          onPress={() => onSelectTab('gis')}
        >
          <Map
            size={22}
            color={currentTab === 'gis' ? colors.primaryDark : colors.textMuted}
            strokeWidth={currentTab === 'gis' ? 2.5 : 1.8}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'gis' && styles.navLabelActive,
            ]}
          >
            GIS Map
          </Text>
        </TouchableOpacity>

        {/* Center Raised Action Button: Report Hazard / Rapid Ground-Truth (+) */}
        <View style={styles.centerButtonContainer}>
          <TouchableOpacity
            style={styles.centerFab}
            activeOpacity={0.85}
            onPress={onCenterActionPress}
            accessibilityLabel="Report Hazard"
          >
            <Plus size={30} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        {/* Tab 3: Alerts with Count Badge */}
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.75}
          onPress={() => onSelectTab('alerts')}
        >
          <View style={styles.iconWithBadge}>
            <Bell
              size={22}
              color={currentTab === 'alerts' ? colors.primaryDark : colors.textMuted}
              strokeWidth={currentTab === 'alerts' ? 2.5 : 1.8}
            />
            {alertsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{alertsCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navLabel,
              currentTab === 'alerts' && styles.navLabelActive,
            ]}
          >
            Alerts
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Profile */}
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.75}
          onPress={() => onSelectTab('profile')}
        >
          <User
            size={22}
            color={currentTab === 'profile' ? colors.primaryDark : colors.textMuted}
            strokeWidth={currentTab === 'profile' ? 2.5 : 1.8}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'profile' && styles.navLabelActive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: 'transparent',
    position: 'relative',
    width: '100%',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F6',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    gap: 3,
  },
  iconWithBadge: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EA580C',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  navLabelActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  centerButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -18,
  },
  centerFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0D382B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#0A382C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
});
