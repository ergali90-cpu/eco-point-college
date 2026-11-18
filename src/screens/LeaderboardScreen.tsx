import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, Empty, FadeIn, Hero, Icon, Segmented, s } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { useLiveData } from '../lib/hooks';
import { kg, LeaderRow, supabase } from '../lib/supabase';
import { C } from '../theme';

const medal = [C.gold, C.silver, C.bronze];

export default function LeaderboardScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [period, setPeriod] = useState<'month' | 'overall'>('overall');
  const [rows, setRows] = useState<LeaderRow[]>([]);

  const [refreshing, reload] = useLiveData(async () => {
    const { data } = await supabase.rpc('leaderboard', { p_period: period, p_limit: 10 });
    setRows((data ?? []) as LeaderRow[]);
  }, ['profiles'], `lb-${period}`);

  React.useEffect(() => { reload(); }, [period]);

  const podium = [rows[1], rows[0], rows[2]];

  return (
    <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={t('leaders.title')} subtitle="TOP 10"
        right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 11 }}>{t('leaders.live')}</Text>
        </View>}>
        <View style={{ marginTop: 18 }}>
          <Segmented value={period} onChange={setPeriod}
            options={[{ value: 'overall', label: t('leaders.overall') }, { value: 'month', label: t('leaders.month') }]} />
        </View>
        {rows.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginTop: 22 }}>
            {podium.map((r, i) => {
              if (!r) return <View key={i} style={{ flex: 1 }} />;
              const place = r.rank;
              const h = place === 1 ? 110 : place === 2 ? 84 : 66;
              return (
                <FadeIn key={r.id} delay={i * 120} style={{ flex: 1, alignItems: 'center' }}>
                  {place === 1 && <Icon name="crown" size={28} color={C.gold} />}
                  <View style={{ width: place === 1 ? 64 : 54, height: place === 1 ? 64 : 54, borderRadius: 40, backgroundColor: C.white, borderWidth: 3, borderColor: medal[place - 1] ?? C.white, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '900', fontSize: 20, color: C.primaryDark }}>{initials(r.full_name)}</Text>
                  </View>
                  <Text style={{ color: C.white, fontWeight: '700', marginTop: 6, fontSize: 12 }} numberOfLines={1}>{r.full_name}</Text>
                  <View style={{ marginTop: 6, width: '100%', height: h, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', paddingTop: 8 }}>
                    <Text style={{ color: C.white, fontSize: 24, fontWeight: '900' }}>{place}</Text>
                    <Text style={{ color: C.accent, fontWeight: '800', fontSize: 12 }}>{r.points}</Text>
                  </View>
                </FadeIn>
              );
            })}
          </View>
        )}
      </Hero>

      <View style={s.body}>
        <Card style={{ paddingVertical: 4 }}>
          {rows.length === 0 ? <Empty icon="trophy-outline" text={t('leaders.empty')} /> : rows.map((r, i) => {
            const me = r.id === profile?.id;
            return (
              <FadeIn key={r.id} delay={i * 40}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: me ? 10 : 0, marginHorizontal: me ? -6 : 0, borderRadius: 14, backgroundColor: me ? C.light : 'transparent', borderTopWidth: i && !me ? 1 : 0, borderColor: C.border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: r.rank <= 3 ? medal[r.rank - 1] : C.mint }}>
                    <Text style={{ fontWeight: '900', color: r.rank <= 3 ? C.white : C.primaryDark }}>{r.rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{r.full_name}{me ? ` (${t('leaders.you')})` : ''}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{r.group_name} • {kg(r.points)} kg</Text>
                  </View>
                  <Text style={{ fontWeight: '900', color: C.primary, fontSize: 16 }}>{r.points}</Text>
                </View>
              </FadeIn>
            );
          })}
        </Card>
      </View>
    </ScrollView>
  );
}

export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
