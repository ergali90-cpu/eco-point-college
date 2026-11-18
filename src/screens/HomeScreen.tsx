import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, Empty, FadeIn, Hero, Icon, ProgressRing, SectionTitle, StatTile, StatusBadge, s } from '../components/ui';
import { LangToggle } from '../components/LangToggle';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { fmtDate, useLiveData } from '../lib/hooks';
import { kg, Redemption, Submission, supabase } from '../lib/supabase';
import { C } from '../theme';

const MILESTONES = [20, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

type Activity = { id: string; kind: 'sub' | 'red'; date: string; title: string; amount: number; status: Submission['status'] };

export default function HomeScreen() {
  const { t, tl, locale } = useI18n();
  const { profile } = useAuth();
  const nav = useNavigation<any>();
  const [rank, setRank] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [acts, setActs] = useState<Activity[]>([]);

  const [refreshing, reload] = useLiveData(async () => {
    if (!profile) return;
    const [r, subs, reds] = await Promise.all([
      supabase.rpc('my_rank'),
      supabase.from('submissions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('redemptions').select('*, rewards(title_kk,title_ru,icon)').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
    ]);
    setRank((r.data as number) ?? null);
    const sl = (subs.data ?? []) as Submission[];
    setPending(sl.filter((x) => x.status === 'pending').reduce((a, b) => a + b.bottles, 0));
    const list: Activity[] = [
      ...sl.map((x) => ({ id: x.id, kind: 'sub' as const, date: x.created_at, title: `${x.bottles} ${t('common.bottles')}`, amount: x.bottles, status: x.status })),
      ...((reds.data ?? []) as Redemption[]).map((x) => ({ id: x.id, kind: 'red' as const, date: x.created_at, title: tl(x.rewards ?? {}, 'title'), amount: -x.cost, status: x.status })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    setActs(list);
  }, ['submissions', 'redemptions'], 'home');

  if (!profile) return null;
  const bottles = profile.total_bottles;
  const next = MILESTONES.find((m) => m > bottles) ?? bottles + 1000;
  const prev = [...MILESTONES].reverse().find((m) => m <= bottles) ?? 0;

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={`${t('home.hello')}, ${profile.full_name.split(' ')[0] || '👋'}`} subtitle={`${profile.group_name} • ${profile.college}`} right={<LangToggle />}>
        <FadeIn delay={100}>
          <View style={{ marginTop: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' }}>{t('home.points')}</Text>
              <Text style={{ color: C.white, fontSize: 44, fontWeight: '900', letterSpacing: -1 }}>{profile.points}</Text>
              {pending > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="clock-outline" size={14} color={C.accent} />
                  <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>+{pending} {t('home.pending_points')}</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'center', backgroundColor: C.white, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 }}>
              <Icon name="trophy" size={22} color={C.gold} />
              <Text style={{ fontSize: 22, fontWeight: '900', color: C.text }}>#{rank ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: C.muted, maxWidth: 80, textAlign: 'center' }}>{t('home.rank')}</Text>
            </View>
          </View>
        </FadeIn>
      </Hero>

      <View style={s.body}>
        <FadeIn delay={200} style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile icon="bottle-soda-outline" value={bottles} label={t('home.bottles')} />
          <StatTile icon="weight-kilogram" value={kg(bottles)} label={t('home.kg')} tint="#0EA5E9" />
          <StatTile icon="molecule-co2" value={Math.round(kg(bottles) * 1.5 * 10) / 10} label={t('stats.co2')} tint="#8B5CF6" />
        </FadeIn>

        <FadeIn delay={300}>
          <Button title={t('home.submit_btn')} icon="plus-circle-outline" onPress={() => nav.navigate('Submit')} style={{ marginTop: 16 }} />
        </FadeIn>

        <FadeIn delay={350}>
          <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ProgressRing value={bottles - prev} max={next - prev} size={96} stroke={10}
              label={`${Math.round(((bottles - prev) / (next - prev)) * 100)}%`} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>{t('home.next_goal')}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{next} {t('common.bottles')}</Text>
              <Text style={{ color: C.muted, marginTop: 4 }}>≈ {kg(next)} kg • {next - bottles} {t('common.bottles')} ⟶</Text>
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={400}>
          <Pressable onPress={() => nav.navigate('Stats')}>
            <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.deep }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chart-areaspline" color={C.accent} />
              </View>
              <Text style={{ flex: 1, color: C.white, fontWeight: '700', fontSize: 15 }}>{t('home.stats_btn')}</Text>
              <Icon name="chevron-right" color={C.white} />
            </Card>
          </Pressable>
        </FadeIn>

        <SectionTitle>{t('home.recent')}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {acts.length === 0 ? <Empty text={t('home.no_activity')} /> : acts.map((a, i) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.border, gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: a.kind === 'sub' ? C.light : '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.kind === 'sub' ? 'recycle' : 'gift-outline'} color={a.kind === 'sub' ? C.primary : C.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{a.title}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDate(a.date, locale, true)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontWeight: '800', color: a.amount > 0 ? C.primary : C.warn }}>{a.amount > 0 ? '+' : ''}{a.amount}</Text>
                <StatusBadge status={a.status} />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}
