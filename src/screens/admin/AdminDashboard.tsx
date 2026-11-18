import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, FadeIn, Hero, Icon, Loading, s } from '../../components/ui';
import { LangToggle } from '../../components/LangToggle';
import { useI18n } from '../../i18n';
import { C } from '../../theme';
import { StatsBody, useStats } from '../StatsScreen';

export default function AdminDashboard() {
  const { t } = useI18n();
  const nav = useNavigation<any>();
  const [stats, refreshing, reload] = useStats();

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={t('admin.title')} subtitle={t('app.name')} right={<LangToggle />}>
        {stats && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <Pending icon="bottle-soda-outline" n={stats.pending_submissions} label={t('admin.pending_sub')} onPress={() => nav.navigate('Verify', { tab: 'sub' })} />
            <Pending icon="gift-outline" n={stats.pending_redemptions} label={t('admin.pending_red')} onPress={() => nav.navigate('Verify', { tab: 'red' })} />
          </View>
        )}
      </Hero>
      <View style={s.body}>
        {stats ? <StatsBody stats={stats} /> : <Loading />}
        <Pressable onPress={() => nav.navigate('AdminRewards')}>
          <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="gift-open-outline" />
            <Text style={{ flex: 1, fontWeight: '700', color: C.text }}>{t('admin.rewards_mgmt')}</Text>
            <Icon name="chevron-right" color={C.muted} />
          </Card>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Pending({ icon, n, label, onPress }: { icon: string; n: number; label: string; onPress: () => void }) {
  return (
    <FadeIn style={{ flex: 1 }}>
      <Pressable onPress={onPress} style={{ backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Icon name={icon} color={C.white} />
          {n > 0 && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent }} />}
        </View>
        <Text style={{ color: C.white, fontSize: 30, fontWeight: '900', marginTop: 6 }}>{n}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }} numberOfLines={2}>{label}</Text>
      </Pressable>
    </FadeIn>
  );
}
