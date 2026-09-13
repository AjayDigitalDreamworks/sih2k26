import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, RotateCw, AlertOctagon, User } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface TopBarProps {
  variant?: 'tasks' | 'default';
  onProfilePress?: () => void;
  onSosPress?: () => void;
  onRefreshPress?: () => void;
  gpsAccuracy?: string;
  isLocked?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  variant = 'default',
  onProfilePress,
  onSosPress,
  onRefreshPress,
  gpsAccuracy = '±0.4m',
  isLocked = true,
}) => {
  if (variant === 'tasks') {
    return (
      <View style={styles.tasksHeader}>
        {/* Left: RAAHI + GIS CORE Badge */}
        <View style={styles.brandPill}>
          <View style={styles.brandIconWrap}>
            <Shield size={18} color="#A7F3D0" strokeWidth={2.4} />
          </View>
          <Text style={styles.brandText}>RAAHI</Text>
          <View style={styles.gisCoreBadge}>
            <Text style={styles.gisCoreText}>GIS</Text>
            <Text style={styles.gisCoreSub}>CORE</Text>
          </View>
        </View>

        {/* Center: RTK GPS Locked Status Pill */}
        <View style={styles.rtkPill}>
          <View style={styles.greenPulseDot} />
          <View style={styles.rtkTextWrap}>
            <Text style={styles.rtkTitle}>RTK GPS: {gpsAccuracy}</Text>
            <Text style={styles.rtkSubtitle}>{isLocked ? 'Locked' : 'Acquiring...'}</Text>
          </View>
        </View>

        {/* Right: Refresh Button */}
        <TouchableOpacity
          style={styles.refreshBtn}
          activeOpacity={0.75}
          onPress={onRefreshPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RotateCw size={17} color="#A7F3D0" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    );
  }

  // Variant: default (GIS, Alerts, Profile)
  return (
    <View style={styles.defaultHeader}>
      <View style={styles.leftGroup}>
        {/* RAAHI Pill */}
        <View style={styles.defaultBrandPill}>
          <Shield size={16} color="#A7F3D0" strokeWidth={2.4} />
          <Text style={styles.defaultBrandText}>RAAHI</Text>
        </View>

        {/* GPS 0.4M Pill */}
        <View style={styles.gpsSmallPill}>
          <View style={styles.smallGreenDot} />
          <Text style={styles.gpsSmallText}>GPS 0.4M</Text>
        </View>
      </View>

      {/* Right Controls: SOS Flare + Profile Avatar */}
      <View style={styles.rightGroup}>
        <TouchableOpacity
          style={styles.sosCircleBtn}
          activeOpacity={0.8}
          onPress={onSosPress}
          accessibilityLabel="Emergency SOS"
        >
          <AlertOctagon size={18} color="#DC2626" strokeWidth={2.2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileCircleBtn}
          activeOpacity={0.8}
          onPress={onProfilePress}
          accessibilityLabel="User Profile"
        >
          <User size={18} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Tasks Screen Top Bar
  tasksHeader: {
    backgroundColor: '#071F15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
  },
  brandIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0E3B2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  gisCoreBadge: {
    backgroundColor: '#114D38',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gisCoreText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#A7F3D0',
    lineHeight: 10,
  },
  gisCoreSub: {
    fontSize: 7,
    fontWeight: '800',
    color: '#6EE7B7',
    lineHeight: 8,
    letterSpacing: 0.3,
  },
  rtkPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B2D20',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#194E38',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    maxWidth: 180,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  rtkTextWrap: {
    flexDirection: 'column',
  },
  rtkTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 13,
  },
  rtkSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6EE7B7',
    lineHeight: 12,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Default Top Bar (GIS, Alerts, Profile)
  defaultHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defaultBrandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A382C',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  defaultBrandText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  gpsSmallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 5,
  },
  smallGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  gpsSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A382C',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
