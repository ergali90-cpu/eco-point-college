import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Card, Empty, Hero, Icon, Input, notify, StatusBadge, s } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { fmtDate, useLiveData } from '../../lib/hooks';
import { errKey, kg, Profile, Submission, supabase, Tx } from '../../lib/supabase';
import { C, R } from '../../theme';
import { initials } from '../LeaderboardScreen';

export default function AdminStudents() {
  const { t, locale } = useI18n();
  const { profile: me } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Profile | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [refreshing, reload] = useLiveData(async () => {
    const { data } = await supabase.from('profiles').select('*').order('total_bottles', { ascending: false });
    const list = (data ?? []) as Profile[];
    setPeople(list);
    setSel((cur) => cur ? list.find((p) => p.id === cur.id) ?? null : null);
  }, ['profiles'], 'students');

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? people.filter((p) => [p.full_name, p.group_name, p.student_id, p.college].some((v) => v?.toLowerCase().includes(k))) : people;
  }, [people, q]);

  async function open(p: Profile) {
    setSel(p); setAmount(''); setReason('');
    const [a, b] = await Promise.all([
      supabase.from('submissions').select('*').eq('user_id', p.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('point_ledger').select('*').eq('user_id', p.id).order('created_at', { ascending: false }).limit(10),
    ]);
    setSubs((a.data ?? []) as Submission[]);
    setTxs((b.data ?? []) as Tx[]);
  }

  async function adjust() {
    const n = parseInt(amount.replace(/[^\d-]/g, ''), 10);
    if (!sel || !n) return;
    setBusy(true);
    const { error } = await supabase.rpc('adjust_points', { p_user: sel.id, p_amount: n, p_reason: reason.trim() });
    setBusy(false);
    if (error) return notify(t('common.error'), t(errKey(error)));
    notify(t('common.success'));
    open({ ...sel, points: sel.points + n });
  }

  async function toggleRole() {
    if (!sel) return;
    const { error } = await supabase.rpc('set_role', { p_user: sel.id, p_role: sel.role === 'admin' ? 'student' : 'admin' });
    if (error) return notify(t('common.error'), t(errKey(error)));
    reload();
  }

  return (
    <View style={s.screen}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />} keyboardShouldPersistTaps="handled">
        <Hero title={t('tab.students')} subtitle={`${people.filter((p) => p.role === 'student').length} ${t('stats.students').toLowerCase()}`} />
        <View style={s.body}>
          <Input icon="magnify" placeholder={t('admin.search')} value={q} onChangeText={setQ} />
          <Card style={{ paddingVertical: 4 }}>
            {filtered.length === 0 ? <Empty text="—" /> : filtered.map((p, i) => (
              <Pressable key={p.id} onPress={() => open(p)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.border }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: p.role === 'admin' ? C.warnBg : C.light, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '900', color: p.role === 'admin' ? C.warn : C.primaryDark }}>{initials(p.full_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{p.full_name || '—'}{p.role === 'admin' ? ' 🛡️' : ''}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{p.group_name} • ID {p.student_id || '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '900', color: C.primary }}>{p.points}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{p.total_bottles} 🍾</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      </ScrollView>

      <Modal visible={!!sel} animationType="slide" transparent onRequestClose={() => setSel(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(6,30,20,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '90%' }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {sel && <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontWeight: '900', fontSize: 18, color: C.primaryDark }}>{initials(sel.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 18, color: C.text }}>{sel.full_name}</Text>
                    <Text style={{ color: C.muted }}>{sel.college} • {sel.group_name} • ID {sel.student_id}</Text>
                  </View>
                  <Pressable onPress={() => setSel(null)} hitSlop={12}><Icon name="close" color={C.muted} /></Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  {[[t('home.points'), sel.points], [t('home.bottles'), sel.total_bottles], ['kg', kg(sel.total_bottles)]].map(([l, v]) => (
                    <Card key={String(l)} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontWeight: '900', fontSize: 20, color: C.text }}>{v}</Text>
                      <Text style={{ color: C.muted, fontSize: 12 }}>{l}</Text>
                    </Card>
                  ))}
                </View>

                {sel.id !== me?.id && <Card style={{ marginTop: 14 }}>
                  <Text style={{ fontWeight: '800', color: C.text, marginBottom: 10 }}>{t('admin.adjust')}</Text>
                  <Input placeholder={t('admin.amount')} value={amount} onChangeText={setAmount} keyboardType="numbers-and-punctuation" icon="plus-minus-variant" />
                  <Input placeholder={t('admin.reason')} value={reason} onChangeText={setReason} icon="text" />
                  <Button title={t('admin.apply')} icon="check" onPress={adjust} loading={busy} />
                  <Button small variant="ghost" icon="shield-account-outline" title={sel.role === 'admin' ? t('admin.make_student') : t('admin.make_admin')}
                    onPress={toggleRole} style={{ marginTop: 10 }} />
                </Card>}

                <Text style={{ fontWeight: '800', color: C.text, marginTop: 18, marginBottom: 8, fontSize: 16 }}>{t('admin.activity')}</Text>
                <Card style={{ paddingVertical: 4 }}>
                  {subs.length === 0 && txs.length === 0 ? <Empty text={t('home.no_activity')} /> : <>
                    {subs.map((x, i) => (
                      <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: C.border, gap: 10 }}>
                        <Icon name="recycle" size={18} />
                        <Text style={{ flex: 1, color: C.text }}>{x.bottles} • {fmtDate(x.collected_on, locale)}</Text>
                        <StatusBadge status={x.status} />
                      </View>
                    ))}
                    {txs.map((x) => (
                      <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderColor: C.border, gap: 10 }}>
                        <Icon name="swap-vertical" size={18} color={C.muted} />
                        <Text style={{ flex: 1, color: C.text }} numberOfLines={1}>{t(`tx.${x.kind}`)} • {fmtDate(x.created_at, locale, true)}</Text>
                        <Text style={{ fontWeight: '800', color: x.amount > 0 ? C.primary : C.warn }}>{x.amount > 0 ? '+' : ''}{x.amount}</Text>
                      </View>
                    ))}
                  </>}
                </Card>
              </>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
