import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, FadeIn, Icon, Input, notify } from '../components/ui';
import { LangToggle } from '../components/LangToggle';
import { useI18n } from '../i18n';
import { errKey, isConfigured, supabase } from '../lib/supabase';
import { C, grad } from '../theme';

export default function AuthScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: '', password: '', full_name: '', college: '', group_name: '', student_id: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!isConfigured) return notify(t('common.error'), t('common.config_missing'));
    const email = f.email.trim().toLowerCase();
    if (!email || !f.password) return notify(t('common.error'), t('auth.fill_all'));
    if (mode === 'register') {
      if (!f.full_name.trim() || !f.college.trim() || !f.group_name.trim() || !f.student_id.trim())
        return notify(t('common.error'), t('auth.fill_all'));
      if (f.password.length < 6) return notify(t('common.error'), t('auth.pw_short'));
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password: f.password,
          options: {
            emailRedirectTo: Platform.OS === 'web' ? window.location.origin + window.location.pathname : undefined,
            data: {
            full_name: f.full_name.trim(), college: f.college.trim(),
            group_name: f.group_name.trim(), student_id: f.student_id.trim(),
          } },
        });
        if (error) throw error;
        if (!data.session) { notify(t('common.success'), t('auth.check_email')); setMode('login'); }
      }
    } catch (e) {
      notify(t('common.error'), t(errKey(e)));
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={grad.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 20, paddingBottom: 80, paddingHorizontal: 24, alignItems: 'center' }}>
          <View style={{ alignSelf: 'flex-end' }}><LangToggle /></View>
          <FadeIn style={{ alignItems: 'center' }}>
            <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
              <Icon name="bottle-soda-classic-outline" size={48} color={C.white} />
              <View style={{ position: 'absolute', right: 10, bottom: 10 }}><Icon name="leaf" size={22} color={C.accent} /></View>
            </View>
            <Text style={{ color: C.white, fontSize: 28, fontWeight: '900', marginTop: 16, letterSpacing: 1 }}>{t('app.name')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8, fontSize: 14, lineHeight: 20 }}>{t('app.slogan')}</Text>
          </FadeIn>
        </LinearGradient>

        <FadeIn delay={150} style={{ marginTop: -56, paddingHorizontal: 18, paddingBottom: 30 }}>
          <Card style={{ padding: 20, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16 }}>
              {mode === 'login' ? t('auth.login') : t('auth.register')}
            </Text>
            {mode === 'register' && <>
              <Input icon="account-outline" placeholder={t('auth.full_name')} value={f.full_name} onChangeText={set('full_name')} />
              <Input icon="school-outline" placeholder={t('auth.college')} value={f.college} onChangeText={set('college')} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Input icon="account-group-outline" placeholder={t('auth.group')} value={f.group_name} onChangeText={set('group_name')} /></View>
                <View style={{ flex: 1 }}><Input icon="card-account-details-outline" placeholder={t('auth.student_id')} value={f.student_id} onChangeText={set('student_id')} /></View>
              </View>
            </>}
            <Input icon="email-outline" placeholder={t('auth.email')} value={f.email} onChangeText={set('email')}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Input icon="lock-outline" placeholder={t('auth.password')} value={f.password} onChangeText={set('password')}
              secureTextEntry onSubmitEditing={submit} />
            <Button title={mode === 'login' ? t('auth.login') : t('auth.register')} icon={mode === 'login' ? 'login' : 'account-plus-outline'}
              onPress={submit} loading={busy} style={{ marginTop: 6 }} />
            <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: C.muted }}>
                {mode === 'login' ? t('auth.no_account') : t('auth.have_account')}{' '}
                <Text style={{ color: C.primary, fontWeight: '800' }}>{mode === 'login' ? t('auth.register') : t('auth.login')}</Text>
              </Text>
            </Pressable>
          </Card>
        </FadeIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
