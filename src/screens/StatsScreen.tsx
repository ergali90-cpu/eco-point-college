import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { BarChart, Card, Empty, FadeIn, Hero, Icon, Loading, ProgressBar, ProgressRing, SectionTitle, StatTile, s } from '../components/ui';
import { useI18n } from '../i18n';
import { useLiveData } from '../lib/hooks';
import { kg, Stats, supabase } from '../lib/supabase';
import { C } from '../theme';

export const COLLEGE_GOAL_KG = 500;

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const live = useLiveData(async () => {
    const { data } = await supabase.rpc('global_stats');
    if (data) setStats(data as Stats);
  }, ['profiles', 'submissions', 'redemptions'], 'stats');
  return [stats, ...live] as const;
}

export function StatsBody({ stats }: { stats: Stats }) {
  const { t, locale } = useI18n();
  const totalKg = kg(stats.total_bottles);
  const monthName = (m: string) => {
    try { return new Date(m + '-01T00:00:00').toLocaleDateString(locale, { month: 'short' }); } catch { return m.slice(5); }
  };
  const maxGroup = Math.max(1, ...stats.groups.map((g) => g.bottles));
  return (
    <>
      <FadeIn style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile icon="bottle-soda-outline" value={stats.total_bottles} label={t('stats.total_bottles')} />
        <StatTile icon="weight-kilogram" value={totalKg} label={t('stats.total_kg')} tint="#0EA5E9" />
      </FadeIn>
      <FadeIn delay={80} style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <StatTile icon="account-heart-outline" value={stats.active_students} label={t('stats.active')} tint="#8B5CF6" />
        <StatTile icon="account-school-outline" value={stats.students} label={t('stats.students')} tint={C.gold} />
      </FadeIn>

      <FadeIn delay={160}>
        <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <ProgressRing value={totalKg} max={COLLEGE_GOAL_KG} size={120} label={`${Math.round((totalKg / COLLEGE_GOAL_KG) * 100)}%`} sub={`${totalKg} / ${COLLEGE_GOAL_KG} kg`} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{t('stats.goal')}</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>{COLLEGE_GOAL_KG} kg</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Icon name="molecule-co2" color="#8B5CF6" />
              <Text style={{ fontWeight: '700', color: C.text }}>{Math.round(totalKg * 1.5)} kg</Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 11 }}>{t('stats.co2')}</Text>
          </View>
        </Card>
      </FadeIn>

      <SectionTitle>{t('stats.monthly')}</SectionTitle>
      <Card>
        <BarChart data={stats.monthly.map((m) => ({ label: monthName(m.month), value: m.bottles }))} />
      </Card>

      <SectionTitle>{t('stats.groups')}</SectionTitle>
      <Card>
        {stats.groups.length === 0 ? <Empty text="—" /> : stats.groups.map((g, i) => (
          <View key={g.name} style={{ marginBottom: i === stats.groups.length - 1 ? 0 : 14 }}>
            <View style={{ flexDirection: 'row', marginBottom: 6, alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', color: i < 3 ? C.gold : C.muted, width: 26 }}>{i + 1}</Text>
              <Text style={{ flex: 1, fontWeight: '700', color: C.text }}>{g.name}</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>{g.students} 👤  </Text>
              <Text style={{ fontWeight: '800', color: C.primary }}>{g.bottles}</Text>
            </View>
            <ProgressBar pct={g.bottles / maxGroup} color={i === 0 ? C.primary : '#4ADE80'} />
          </View>
        ))}
      </Card>
    </>
  );
}

export default function StatsScreen() {
  const { t } = useI18n();
  const nav = useNavigation();
  const [stats, refreshing, reload] = useStats();
  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={t('stats.title')} subtitle={t('app.slogan')}
        right={<Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 6 }}>
          <Icon name="close" color={C.white} />
        </Pressable>} />
      <View style={s.body}>{stats ? <StatsBody stats={stats} /> : <Loading />}</View>
    </ScrollView>
  );
}
