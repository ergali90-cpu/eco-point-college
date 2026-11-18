import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Empty, FadeIn, Hero, Icon, notify, Segmented, StatusBadge, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { fmtDate, useLiveData } from '../../lib/hooks';
import { errKey, kg, Redemption, Status, Submission, supabase } from '../../lib/supabase';
import { C, R } from '../../theme';

export default function AdminVerify() {
  const { t, tl, locale } = useI18n();
  const { profile } = useAuth();
  const route = useRoute<any>();
  const [tab, setTab] = useState<'sub' | 'red'>(route.params?.tab ?? 'sub');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [subs, setSubs] = useState<Submission[]>([]);
  const [reds, setReds] = useState<Redemption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => { if (route.params?.tab) setTab(route.params.tab); }, [route.params?.tab]);

  const [refreshing, reload] = useLiveData(async () => {
    const q1 = supabase.from('submissions').select('*, profiles!submissions_user_id_fkey(full_name,group_name,student_id)').order('created_at', { ascending: filter === 'pending' }).limit(100);
    const q2 = supabase.from('redemptions').select('*, rewards(title_kk,title_ru,icon), profiles!redemptions_user_id_fkey(full_name,group_name)').order('created_at', { ascending: filter === 'pending' }).limit(100);
    const [a, b] = await Promise.all([filter === 'pending' ? q1.eq('status', 'pending') : q1, filter === 'pending' ? q2.eq('status', 'pending') : q2]);
    if (a.error) console.warn(a.error.message);
    setSubs((a.data ?? []) as Submission[]);
    setReds((b.data ?? []) as Redemption[]);
  }, ['submissions', 'redemptions'], 'verify');

  useEffect(() => { reload(); }, [filter]);

  async function review(kind: 'sub' | 'red', id: string, approve: boolean) {
    setBusy(id + approve);
    const { error } = kind === 'sub'
      ? await supabase.rpc('review_submission', { p_id: id, p_approve: approve, p_note: notes[id]?.trim() || null })
      : await supabase.rpc('review_redemption', { p_id: id, p_approve: approve });
    setBusy(null);
    if (error) return notify(t('common.error'), t(errKey(error)));
    // optimistic removal / update
    const st: Status = approve ? 'approved' : 'rejected';
    if (kind === 'sub') setSubs((l) => filter === 'pending' ? l.filter((x) => x.id !== id) : l.map((x) => x.id === id ? { ...x, status: st } : x));
    else setReds((l) => filter === 'pending' ? l.filter((x) => x.id !== id) : l.map((x) => x.id === id ? { ...x, status: st } : x));
  }

  const Actions = ({ kind, id, own }: { kind: 'sub' | 'red'; id: string; own: boolean }) => own
    ? <Text style={{ color: C.danger, marginTop: 10, fontSize: 12 }}>{t('err.cannot_review_own')}</Text>
    : (
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Button small variant="ghost" icon="close" title={t('admin.reject')} onPress={() => review(kind, id, false)} loading={busy === id + false} style={{ flex: 1 }} />
        <Button small icon="check" title={t('admin.approve')} onPress={() => review(kind, id, true)} loading={busy === id + true} style={{ flex: 1 }} />
      </View>
    );

  const list = tab === 'sub' ? subs : reds;

  return (
    <View style={s.screen}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
        <Hero title={t('tab.verify')} subtitle={`${list.length} • ${filter === 'pending' ? t('status.pending') : t('admin.all')}`}>
          <View style={{ marginTop: 16, gap: 10 }}>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'sub', label: t('admin.submissions') }, { value: 'red', label: t('admin.redemptions') }]} />
            <Segmented value={filter} onChange={setFilter} options={[{ value: 'pending', label: t('status.pending') }, { value: 'all', label: t('admin.all') }]} />
          </View>
        </Hero>
        <View style={s.body}>
          {list.length === 0 && <Card><Empty icon="check-all" text={t('admin.no_pending')} /></Card>}
          {tab === 'sub' && subs.map((x, i) => (
            <FadeIn key={x.id} delay={i * 30}>
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable onPress={() => x.photo_url && setPhoto(x.photo_url)}>
                    {x.photo_url
                      ? <Image source={{ uri: x.photo_url }} style={{ width: 64, height: 64, borderRadius: 14 }} />
                      : <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}><Icon name="image-off-outline" color={C.muted} /></View>}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: C.text }}>{x.profiles?.full_name}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{x.profiles?.group_name} • ID {x.profiles?.student_id}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDate(x.collected_on, locale)} • {fmtDate(x.created_at, locale, true)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '900', fontSize: 22, color: C.primary }}>{x.bottles}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>{kg(x.bottles)} kg</Text>
                  </View>
                </View>
                {x.status === 'pending' ? <>
                  <TextInput placeholder={t('admin.note')} placeholderTextColor="#9DB0A4" value={notes[x.id] ?? ''}
                    onChangeText={(v) => setNotes((n) => ({ ...n, [x.id]: v }))}
                    style={{ marginTop: 12, backgroundColor: C.mint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: C.text }} />
                  <Actions kind="sub" id={x.id} own={x.user_id === profile?.id} />
                </> : <View style={{ marginTop: 10 }}><StatusBadge status={x.status} /></View>}
              </Card>
            </FadeIn>
          ))}
          {tab === 'red' && reds.map((x, i) => (
            <FadeIn key={x.id} delay={i * 30}>
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.warnBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={x.rewards?.icon ?? 'gift-outline'} color={C.warn} size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: C.text }}>{tl(x.rewards ?? {}, 'title')}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{x.profiles?.full_name} • {x.profiles?.group_name}</Text>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDate(x.created_at, locale, true)}</Text>
                  </View>
                  <Text style={{ fontWeight: '900', fontSize: 18, color: C.warn }}>−{x.cost}</Text>
                </View>
                {x.status === 'pending' ? <Actions kind="red" id={x.id} own={x.user_id === profile?.id} />
                  : <View style={{ marginTop: 10 }}><StatusBadge status={x.status} /></View>}
              </Card>
            </FadeIn>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable onPress={() => setPhoto(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: '70%', borderRadius: R.lg }} resizeMode="contain" />}
          <Text style={{ color: C.white, marginTop: 16 }}>{t('common.close')}</Text>
        </Pressable>
      </Modal>
    </View>
  );
}
