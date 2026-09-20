import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

interface MobileContainerProps {
  children: React.ReactNode;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({ children }) => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWide = width > 520;

  if (isWeb && isWide) {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.phoneFrame}>
          {children}
        </View>
      </View>
    );
  }

  return <View style={styles.mobileFull}>{children}</View>;
};

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#071611', // Deep forest night backdrop for SDRF GIS Officer preview
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: '100%',
  },
  phoneFrame: {
    width: 412,
    height: 890,
    maxHeight: '97vh' as any,
    backgroundColor: '#F8F9FD',
    borderRadius: 44,
    overflow: 'hidden',
    borderWidth: 10,
    borderColor: '#12261E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.55,
    shadowRadius: 35,
    elevation: 20,
  },
  mobileFull: {
    flex: 1,
    backgroundColor: '#F8F9FD',
    width: '100%',
    height: '100%',
  },
});
