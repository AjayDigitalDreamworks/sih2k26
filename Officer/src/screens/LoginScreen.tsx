import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Check,
  ArrowLeft,
  Radio,
  MapPin,
} from 'lucide-react-native';
import { RaahiLogo } from '../components/common/RaahiLogo';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onNavigateToSignUp?: () => void;
  onBackToLanding?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onBackToLanding,
}) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('officer1@raahi.gov.in');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    const loginEmail = identifier.trim() || 'officer1@raahi.gov.in';
    const loginPass = password || 'password123';
    setIsLoading(true);
    try {
      await login(loginEmail, loginPass);
      onLoginSuccess();
    } catch (err: any) {
      Alert.alert(
        'Login Error',
        err?.response?.data?.message || err?.message || 'Invalid credentials. Use: officer1@raahi.gov.in / password123'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topSection}>
            <View style={styles.scenicGraphicWrap}>
              <Image
                source={require('../../assets/login-hero-truck.png')}
                style={styles.scenicImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.leftContentCol}>
              {onBackToLanding && (
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={onBackToLanding}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ArrowLeft size={20} color="#0F172A" />
                </TouchableOpacity>
              )}
              <View style={styles.brandRow}>
                <RaahiLogo height={34} />
                <View style={styles.officerPill}>
                  <Text style={styles.officerPillText}>OFFICER</Text>
                </View>
              </View>
              <Text style={styles.screenHeading}>Field Operative Login</Text>
              <Text style={styles.screenSub}>
                Authenticate with SDRF Field Operative Credentials
              </Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>OFFICER EMAIL</Text>
              </View>
              <View style={styles.inputFieldWrap}>
                <View style={styles.inputIconBox}>
                  <User size={18} color="#0A382C" />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="officer1@raahi.gov.in"
                  placeholderTextColor="#94A3B8"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <TouchableOpacity onPress={() => Alert.alert('Reset PIN', 'Contact SDRF Command to reset your operative PIN.')}>
                  <Text style={styles.forgotLink}>Forgot PIN?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputFieldWrap}>
                <View style={styles.inputIconBox}>
                  <Lock size={18} color="#0A382C" />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#64748B" />
                  ) : (
                    <Eye size={20} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rememberRow}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <View style={styles.rtkReadyPill}>
                <View style={styles.rtkDot} />
                <Text style={styles.rtkReadyText}>RTK Ready</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Authenticate & Sync</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.securityNotice}>
              <ShieldCheck size={18} color="#16A34A" />
              <Text style={styles.securityText}>
                End-to-end encrypted channel. Field operative session authenticated via SDRF GIS Credential Registry.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardAvoid: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  topSection: { position: 'relative', minHeight: 220, marginBottom: 8 },
  scenicGraphicWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, overflow: 'hidden' },
  scenicImage: { width: '100%', height: '100%', opacity: 0.15 },
  leftContentCol: { paddingHorizontal: 22, paddingTop: 40 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  officerPill: { backgroundColor: '#0A382C', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  officerPillText: { color: '#A7F3D0', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  screenHeading: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  screenSub: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  formContainer: { paddingHorizontal: 22, paddingTop: 24, gap: 18 },
  inputGroup: { gap: 7 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#475569', letterSpacing: 0.6 },
  forgotLink: { fontSize: 12, fontWeight: '700', color: '#0D684D' },
  inputFieldWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 50 },
  inputIconBox: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 14.5, fontWeight: '600', color: '#0F172A' },
  eyeBtn: { padding: 4 },
  rememberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: '#0A382C', borderColor: '#0A382C' },
  rememberText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  rtkReadyPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 5 },
  rtkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  rtkReadyText: { fontSize: 11, fontWeight: '700', color: '#065F46' },
  loginBtn: { backgroundColor: '#0A382C', height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, shadowColor: '#0A382C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  loginBtnDisabled: { opacity: 0.65 },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  securityNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: '#BBF7D0', marginTop: 6 },
  securityText: { flex: 1, fontSize: 11.5, color: '#166534', lineHeight: 16, fontWeight: '500' },
});
