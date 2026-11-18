import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, confirm, Empty, FadeIn, Hero, Icon, notify, ProgressBar, SectionTitle, StatusBadge, s } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { fmtDate, useLiveData } from '../lib/hooks';
import { errKey, Redemption, Reward, supabase } from '../lib/supabase';
import { C, R } from '../theme';

const CATS = ['all', 'merch', 'stationery', 'eco', 'certificate', 'gift'] as const;
export const catColor: Record<string, string> = {
  merch: '#16A34A', stationery: '#0EA5E9', eco: '#65A30D', certificate: '#8B5CF6', gift: '#F59E0B',
};

export default function RewardsScreen() {
  const { t, tl, locale } = useI18n();
  const { profile } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [cat, setCat] = useState<(typeof CATS)[number]>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [refreshing, reload] = useLiveData(async () => {
    if (!profile) return;
    const [r, m] = await Promise.all([
      supabase.from('rewards').select('*').eq('active', true).order('cost'),
      supabase.from('redemptions').select('*, rewards(title_kk,title_ru,icon)').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setRewards((r.data ?? []) as Reward[]);
    setMine((m.data ?? []) as Redemption[]);
  }, ['rewards', 'redemptions'], 'rewards');

  if (!profile) return null;
  const held = mine.filter((m) => m.status === 'pending').reduce((a, b) => a + b.cost, 0);
  const available = profile.points - held;
  const list = rewards.filter((r) => cat === 'all' || r.category === cat);

  async function redeem(r: Reward) {
    const ok = await confirm(tl(r, 'title'), `${t('rewards.confirm')}\n${r.cost} ${t('common.points')}`, t('rewards.exchange'), t('common.cancel'));
    if (!ok) return;
    setBusyId(r.id);
    const { error } = await supabase.rpc('request_reward', { p_reward: r.id });
    setBusyId(null);
    if (error) return notify(t('common.error'), t(errKey(error)));
    notify(t('common.success'), t('rewards.requested'));
    reload();
  }

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={t('rewards.title')} right={<Icon name="storefront-outline" size={38} color="rgba(255,255,255,0.9)" />}>
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 14, gap: 12 }}>
          <Icon name="star-four-points" size={30} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{t('rewards.balance')}</Text>
            <Text style={{ color: C.white, fontSize: 30, fontWeight: '900' }}>{available}</Text>
          </View>
          {held > 0 && <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>−{held} {t('home.pending_points')}</Text>}
        </View>
      </Hero>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 8 }}>
        {CATS.map((c) => (
          <Pressable key={c} onPress={() => setCat(c)}
            style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: cat === c ? C.primary : C.white, borderWidth: 1, borderColor: cat === c ? C.primary : C.border }}>
            <Text style={{ fontWeight: '700', color: cat === c ? C.white : C.text }}>{t(`cat.${c}`)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[s.body, { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
        {list.length === 0 && <View style={{ width: '100%' }}><Empty icon="gift-off-outline" text="—" /></View>}
        {list.map((r, i) => {
          const can = available >= r.cost && r.stock > 0;
          const color = catColor[r.category] ?? C.primary;
          return (
            <FadeIn key={r.id} delay={i * 50} style={{ width: '47.5%', flexGrow: 1, maxWidth: 360 }}>
              <Card style={{ padding: 14, height: '100%' }}>
                <View style={{ height: 86, borderRadius: R.md, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={r.icon} size={42} color={color} />
                  <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: C.white, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color }}>{t(`cat.${r.category}`)}</Text>
                  </View>
                </View>
                <Text style={{ fontWeight: '800', color: C.text, marginTop: 10 }} numberOfLines={2}>{tl(r, 'title')}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, minHeight: 32 }} numberOfLines={2}>{tl(r, 'desc')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Icon name="star-four-points" size={16} color={C.gold} />
                  <Text style={{ fontWeight: '900', color: C.text, fontSize: 16 }}>{r.cost}</Text>
                  <Text style={{ flex: 1, textAlign: 'right', fontSize: 11, color: r.stock ? C.muted : C.danger }}>
                    {r.stock ? `${t('rewards.stock')}: ${r.stock}` : t('rewards.out')}
                  </Text>
                </View>
                {!can && r.stock > 0 && <View style={{ marginTop: 8 }}><ProgressBar pct={available / r.cost} /></View>}
                <Button small title={r.stock === 0 ? t('rewards.out') : can ? t('rewards.exchange') : t('rewards.not_enough')}
                  variant={can ? 'primary' : 'ghost'} disabled={!can} loading={busyId === r.id}
                  onPress={() => redeem(r)} style={{ marginTop: 10 }} />
              </Card>
            </FadeIn>
          );
        })}
      </View>

      {mine.length > 0 && (
        <View style={[s.body, { paddingTop: 0 }]}>
          <SectionTitle>{t('rewards.my_requests')}</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {mine.map((m, i) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.border }}>
                <Icon name={m.rewards?.icon ?? 'gift-outline'} color={C.warn} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.text }}>{tl(m.rewards ?? {}, 'title')}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDate(m.created_at, locale, true)} • {m.cost} {t('common.points')}</Text>
                </View>
                <StatusBadge status={m.status} />
              </View>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
