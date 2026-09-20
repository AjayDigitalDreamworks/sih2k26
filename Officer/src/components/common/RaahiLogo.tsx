import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';

export interface RaahiLogoProps {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
}

export const RaahiLogo: React.FC<RaahiLogoProps> = ({
  width,
  height = 40,
  color,
  style,
}) => {
  const calculatedWidth = width || Math.round(height * (191 / 59));

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../../assets/raahi-logo.png')}
        style={[styles.logoImage, { width: calculatedWidth, height }]}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logoImage: {
    maxWidth: '100%',
  },
});
