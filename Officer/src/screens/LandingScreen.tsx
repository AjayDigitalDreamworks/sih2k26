import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  Platform,
  StatusBar,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  Globe,
  ChevronDown,
  Shield,
  Activity,
  Radio,
  ArrowRight,
  Check,
  X,
  Compass,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LandingScreenProps {
  onGetStarted: () => void;
  onSignIn?: () => void;
}

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mni', name: 'Manipuri', nativeName: 'মৈতৈলোন্' },
];

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onGetStarted,
  onSignIn,
}) => {
  const [selectedLang, setSelectedLang] = useState<LanguageOption>(LANGUAGES[0]);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const handleSelectLanguage = (lang: LanguageOption) => {
    setSelectedLang(lang);
    setLangModalVisible(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Scenic Mountain Backdrop */}
      <ImageBackground
        source={require('../../assets/landing-bg.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Bar: Language Selector */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.langPill}
                activeOpacity={0.8}
                onPress={() => setLangModalVisible(true)}
              >
                <Globe size={15} color="#A7F3D0" strokeWidth={2} />
                <Text style={styles.langPillText}>{selectedLang.name}</Text>
                <ChevronDown size={14} color="#A7F3D0" strokeWidth={2.2} />
              </TouchableOpacity>

              <View style={styles.sdrfBadge}>
                <Shield size={13} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.sdrfBadgeText}>SDRF GIS COMMAND</Text>
              </View>
            </View>

            {/* Central Hero Artwork (Satellite + Mountains + GIS Beacon) */}
            <View style={styles.heroContainer}>
              <Image
                source={require('../../assets/raahi-hero-artwork.png')}
                style={styles.heroArtwork}
                resizeMode="contain"
              />
            </View>

            {/* Typography & Value Proposition */}
            <View style={styles.textBlock}>
              <Text style={styles.eyebrow}>STATE DISASTER RESPONSE FORCE</Text>
              <Text style={styles.title}>
                Geospatial <Text style={styles.titleAccent}>Ground-Truth</Text> & Hazard Response
              </Text>
              <Text style={styles.subtitle}>
                Centimeter-precision RTK GNSS telemetry, AI-assisted seismic ground verification, and direct off-grid satellite uplink for frontline disaster operatives.
              </Text>
            </View>

            {/* Feature Pills */}
            <View style={styles.featuresRow}>
              <View style={styles.featureItem}>
                <View style={styles.featureIconWrap}>
                  <Compass size={16} color="#0D4B39" strokeWidth={2.2} />
                </View>
                <Text style={styles.featureText}>±0.4m RTK Precision</Text>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconWrap}>
                  <Activity size={16} color="#0D4B39" strokeWidth={2.2} />
                </View>
                <Text style={styles.featureText}>Live Sensor Telemetry</Text>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconWrap}>
                  <Radio size={16} color="#0D4B39" strokeWidth={2.2} />
                </View>
                <Text style={styles.featureText}>Off-Grid MESH Sync</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={onGetStarted}
              >
                <Text style={styles.primaryButtonText}>Access Officer Console</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.8}
                onPress={onSignIn || onGetStarted}
              >
                <Text style={styles.secondaryButtonText}>
                  Operative ID Sign In
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footerNote}>
              Encrypted & Verified via SDRF State Emergency Center • NavIC / GPS Dual-Band
            </Text>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>

      {/* Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Globe size={20} color="#0A382C" strokeWidth={2} />
                <Text style={styles.modalTitle}>Select Operative Language</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setLangModalVisible(false)}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.langList}>
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLang.code === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langOption,
                      isSelected && styles.langOptionSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectLanguage(lang)}
                  >
                    <View style={styles.langOptionLeft}>
                      <Text
                        style={[
                          styles.langOptionName,
                          isSelected && styles.langOptionNameSelected,
                        ]}
                      >
                        {lang.name}
                      </Text>
                      <Text
                        style={[
                          styles.langOptionNative,
                          isSelected && styles.langOptionNativeSelected,
                        ]}
                      >
                        {lang.nativeName}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071F15',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 28,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 56, 44, 0.75)',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.28)',
  },
  langPillText: {
    color: '#F0FDF4',
    fontSize: 13,
    fontWeight: '600',
  },
  sdrfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A382C',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 5,
  },
  sdrfBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  heroArtwork: {
    width: Math.min(SCREEN_WIDTH * 0.88, 380),
    height: 190,
  },
  textBlock: {
    marginVertical: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#064E3B',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 33,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  titleAccent: {
    color: '#0A382C',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionContainer: {
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#0A382C',
    paddingVertical: 15,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#0A382C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0A382C',
  },
  secondaryButtonText: {
    color: '#0A382C',
    fontSize: 15,
    fontWeight: '700',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 10,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '500',
  },

  // Language Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  langList: {
    marginTop: 12,
    gap: 8,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  langOptionSelected: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  langOptionLeft: {
    gap: 2,
  },
  langOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  langOptionNameSelected: {
    color: '#065F46',
  },
  langOptionNative: {
    fontSize: 12,
    color: '#64748B',
  },
  langOptionNativeSelected: {
    color: '#059669',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
