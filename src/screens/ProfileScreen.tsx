import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, Empty, FadeIn, Hero, Icon, Input, notify, SectionTitle, StatTile, s } from '../components/ui';
import { LangToggle } from '../components/LangToggle';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { fmtDate, useLiveData } from '../lib/hooks';
import { errKey, kg, supabase, Tx } from '../lib/supabase';
import { C } from '../theme';
import { initials } from './LeaderboardScreen';

export default function ProfileScreen() {
  const { t, locale } = useI18n();
  const { profile, signOut, refreshProfile, session } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ full_name: '', college: '', group_name: '' });

  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name, college: profile.college, group_name: profile.group_name });
  }, [profile?.id, editing]);

  const [refreshing, reload] = useLiveData(async () => {
    if (!profile) return;
    const { data } = await supabase.from('point_ledger').select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(50);
    setTxs((data ?? []) as Tx[]);
  }, ['profiles'], 'profile');

  if (!profile) return null;
  const isAdmin = profile.role === 'admin';

  async function save() {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: f.full_name.trim(), college: f.college.trim(), group_name: f.group_name.trim(),
    }).eq('id', profile!.id);
    setBusy(false);
    if (error) return notify(t('common.error'), t(errKey(error)));
    await refreshProfile();
    setEditing(false);
    notify(t('profile.saved'));
  }

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={t('profile.title')} right={<LangToggle />}>
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.accent }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: C.primaryDark }}>{initials(profile.full_name)}</Text>
          </View>
          <Text style={{ color: C.white, fontSize: 20, fontWeight: '800', marginTop: 10 }}>{profile.full_name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{session?.user.email}</Text>
          {isAdmin && (
            <View style={{ marginTop: 8, backgroundColor: C.gold, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Icon name="shield-crown-outline" size={14} color={C.white} />
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 12 }}>{t('profile.admin_badge')}</Text>
            </View>
          )}
        </View>
      </Hero>

      <View style={s.body}>
        {!isAdmin && (
          <FadeIn style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile icon="star-four-points-outline" value={profile.points} label={t('home.points')} tint={C.gold} />
            <StatTile icon="bottle-soda-outline" value={profile.total_bottles} label={t('home.bottles')} />
            <StatTile icon="weight-kilogram" value={kg(profile.total_bottles)} label={t('home.kg')} tint="#0EA5E9" />
          </FadeIn>
        )}

        <Card style={{ marginTop: 16 }}>
          {editing ? <>
            <Input label={t('auth.full_name')} value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} />
            <Input label={t('auth.college')} value={f.college} onChangeText={(v) => setF({ ...f, college: v })} />
            <Input label={t('auth.group')} value={f.group_name} onChangeText={(v) => setF({ ...f, group_name: v })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title={t('profile.save')} icon="content-save-outline" onPress={save} loading={busy} style={{ flex: 1 }} />
            </View>
          </> : <>
            <InfoRow icon="school-outline" label={t('auth.college')} value={profile.college} />
            <InfoRow icon="account-group-outline" label={t('auth.group')} value={profile.group_name} />
            <InfoRow icon="card-account-details-outline" label={t('auth.student_id')} value={profile.student_id} />
            <InfoRow icon="calendar-check-outline" label={t('profile.member_since')} value={fmtDate(profile.created_at, locale)} last />
            <Button small variant="ghost" icon="pencil-outline" title={t('profile.edit')} onPress={() => setEditing(true)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          </>}
        </Card>

        <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="translate" />
          <Text style={{ flex: 1, marginLeft: 10, fontWeight: '700', color: C.text }}>{t('profile.language')}</Text>
          <LangToggle dark />
        </Card>

        {!isAdmin && <>
          <SectionTitle>{t('profile.history')}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {txs.length === 0 ? <Empty icon="history" text={t('profile.no_tx')} /> : txs.map((x, i) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderColor: C.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: x.amount > 0 ? C.light : C.warnBg }}>
                  <Icon name={x.kind === 'earn' ? 'arrow-down-bold' : x.kind === 'spend' ? 'arrow-up-bold' : 'tune-variant'} size={18} color={x.amount > 0 ? C.primary : C.warn} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.text }}>{t(`tx.${x.kind}`)}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{fmtDate(x.created_at, locale, true)}{x.description ? ` • ${x.description}` : ''}</Text>
                </View>
                <Text style={{ fontWeight: '900', color: x.amount > 0 ? C.primary : C.warn }}>{x.amount > 0 ? '+' : ''}{x.amount}</Text>
              </View>
            ))}
          </Card>
        </>}

        <Button title={t('auth.logout')} icon="logout" variant="danger" onPress={signOut} style={{ marginTop: 24 }} />
        <Text style={{ textAlign: 'center', color: C.muted, marginTop: 16, fontSize: 12 }}>{t('app.name')} • {t('app.slogan')}</Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: C.border }}>
      <Icon name={icon} color={C.muted} />
      <Text style={{ color: C.muted, flex: 1 }}>{label}</Text>
      <Text style={{ color: C.text, fontWeight: '700' }}>{value || '—'}</Text>
    </View>
  );
}
