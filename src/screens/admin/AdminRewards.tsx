import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { Button, Card, confirm, Hero, Icon, Input, notify, s } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useLiveData } from '../../lib/hooks';
import { errKey, Reward, supabase } from '../../lib/supabase';
import { C, R } from '../../theme';
import { catColor } from '../RewardsScreen';

const CATS: Reward['category'][] = ['merch', 'stationery', 'eco', 'certificate', 'gift'];
const ICONS = ['tshirt-crew', 'hanger', 'notebook', 'pencil-ruler', 'bottle-tonic-outline', 'shopping-outline', 'certificate-outline', 'medal-outline', 'ticket-outline', 'gift-outline', 'cup-outline', 'tree-outline', 'bag-personal-outline', 'headphones'];
const blank: Omit<Reward, 'id'> = { title_kk: '', title_ru: '', desc_kk: '', desc_ru: '', category: 'merch', cost: 100, stock: 10, icon: 'gift-outline', active: true };

export default function AdminRewards() {
  const { t, tl } = useI18n();
  const nav = useNavigation();
  const [list, setList] = useState<Reward[]>([]);
  const [edit, setEdit] = useState<(Partial<Reward> & typeof blank) | null>(null);
  const [busy, setBusy] = useState(false);

  const [refreshing, reload] = useLiveData(async () => {
    const { data } = await supabase.from('rewards').select('*').order('cost');
    setList((data ?? []) as Reward[]);
  }, ['rewards'], 'admin-rewards');

  async function save() {
    if (!edit) return;
    if (!edit.title_kk.trim() || !edit.title_ru.trim() || !(edit.cost > 0) || edit.stock < 0) return notify(t('common.error'), t('auth.fill_all'));
    setBusy(true);
    const { id, ...row } = edit as Reward;
    const { error } = id ? await supabase.from('rewards').update(row).eq('id', id) : await supabase.from('rewards').insert(row);
    setBusy(false);
    if (error) return notify(t('common.error'), t(errKey(error)));
    setEdit(null); reload();
  }

  async function remove() {
    if (!edit?.id) return;
    if (!(await confirm(t('admin.delete'), tl(edit, 'title'), t('admin.delete'), t('common.cancel')))) return;
    // Rewards that were already redeemed are kept for history — just deactivate them.
    const { error } = await supabase.from('rewards').delete().eq('id', edit.id);
    if (error) await supabase.from('rewards').update({ active: false }).eq('id', edit.id);
    setEdit(null); reload();
  }

  const num = (v: string) => parseInt(v.replace(/\D/g, '') || '0', 10);

  return (
    <View style={s.screen}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
        <Hero title={t('admin.rewards_mgmt')} subtitle={`${list.length}`}
          right={<Pressable onPress={() => nav.goBack()} hitSlop={12} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 6 }}><Icon name="close" color={C.white} /></Pressable>} />
        <View style={s.body}>
          <Button title={t('admin.new_reward')} icon="plus" onPress={() => setEdit({ ...blank })} />
          {list.map((r) => (
            <Pressable key={r.id} onPress={() => setEdit({ ...r })}>
              <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: r.active ? 1 : 0.5 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: (catColor[r.category] ?? C.primary) + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={r.icon} color={catColor[r.category]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.text }}>{tl(r, 'title')}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }}>{t(`cat.${r.category}`)} • {t('admin.stock')}: {r.stock}</Text>
                </View>
                <Text style={{ fontWeight: '900', color: C.text }}>{r.cost}</Text>
                <Icon name="pencil-outline" size={18} color={C.muted} />
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!edit} animationType="slide" transparent onRequestClose={() => setEdit(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(6,30,20,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '92%' }}>
            {edit && <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.text }}>{edit.id ? tl(edit, 'title') : t('admin.new_reward')}</Text>
                <Pressable onPress={() => setEdit(null)} hitSlop={12}><Icon name="close" color={C.muted} /></Pressable>
              </View>
              <Input label={t('admin.title_kk')} value={edit.title_kk} onChangeText={(v) => setEdit({ ...edit, title_kk: v })} />
              <Input label={t('admin.title_ru')} value={edit.title_ru} onChangeText={(v) => setEdit({ ...edit, title_ru: v })} />
              <Input label={t('admin.desc_kk')} value={edit.desc_kk} onChangeText={(v) => setEdit({ ...edit, desc_kk: v })} />
              <Input label={t('admin.desc_ru')} value={edit.desc_ru} onChangeText={(v) => setEdit({ ...edit, desc_ru: v })} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Input label={t('admin.cost')} value={String(edit.cost)} keyboardType="number-pad" onChangeText={(v) => setEdit({ ...edit, cost: num(v) })} /></View>
                <View style={{ flex: 1 }}><Input label={t('admin.stock')} value={String(edit.stock)} keyboardType="number-pad" onChangeText={(v) => setEdit({ ...edit, stock: num(v) })} /></View>
              </View>
              <Text style={{ fontWeight: '600', color: C.text, marginBottom: 6, fontSize: 13 }}>{t('admin.category')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {CATS.map((c) => (
                  <Pressable key={c} onPress={() => setEdit({ ...edit, category: c })}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: edit.category === c ? C.primary : C.light }}>
                    <Text style={{ fontWeight: '700', color: edit.category === c ? C.white : C.primaryDark }}>{t(`cat.${c}`)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {ICONS.map((ic) => (
                  <Pressable key={ic} onPress={() => setEdit({ ...edit, icon: ic })}
                    style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: edit.icon === ic ? C.primary : C.white }}>
                    <Icon name={ic} color={edit.icon === ic ? C.white : C.primaryDark} />
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ flex: 1, fontWeight: '700', color: C.text }}>{t('admin.active')}</Text>
                <Switch value={edit.active} onValueChange={(v) => setEdit({ ...edit, active: v })} trackColor={{ true: C.primary, false: C.border }} />
              </View>
              <Button title={t('profile.save')} icon="content-save-outline" onPress={save} loading={busy} />
              {edit.id && <Button title={t('admin.delete')} icon="trash-can-outline" variant="ghost" onPress={remove} style={{ marginTop: 10 }} />}
            </ScrollView>}
          </View>
        </View>
      </Modal>
    </View>
  );
}
