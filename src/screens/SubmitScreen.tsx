import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, Card, Empty, FadeIn, Hero, Icon, Input, notify, SectionTitle, StatusBadge, s } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { base64ToBytes, fmtDate, isoDay, useLiveData, uuid } from '../lib/hooks';
import { errKey, kg, Submission, supabase } from '../lib/supabase';
import { C, R } from '../theme';

type Photo = { uri: string; base64?: string | null; mime: string };

export default function SubmitScreen() {
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  const [qty, setQty] = useState(20);
  const [date, setDate] = useState(isoDay());
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Submission[]>([]);
  // One idempotency key per *form*, so double taps / retries never create two rows.
  const requestId = useRef(uuid());

  const [refreshing, reload] = useLiveData(async () => {
    if (!profile) return;
    const { data } = await supabase.from('submissions').select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(30);
    setHistory((data ?? []) as Submission[]);
  }, ['submissions'], 'submit');

  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: true };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPhoto({ uri: a.uri, base64: a.base64, mime: a.mimeType ?? 'image/jpeg' });
    }
  }

  async function uploadPhoto(p: Photo): Promise<string> {
    const ext = p.mime.split('/')[1] ?? 'jpg';
    const path = `${profile!.id}/${requestId.current}.${ext}`;
    const body = p.base64 ? base64ToBytes(p.base64) : await (await fetch(p.uri)).arrayBuffer();
    const { error } = await supabase.storage.from('bottle-photos').upload(path, body, { contentType: p.mime, upsert: true });
    if (error) throw error;
    return supabase.storage.from('bottle-photos').getPublicUrl(path).data.publicUrl;
  }

  async function send() {
    if (!profile) return;
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) return notify(t('common.error'), t('submit.invalid_qty'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > isoDay() || isNaN(Date.parse(date))) return notify(t('common.error'), t('submit.invalid_date'));
    setBusy(true);
    try {
      const photo_url = photo ? await uploadPhoto(photo) : null;
      const { error } = await supabase.from('submissions').insert({
        request_id: requestId.current, user_id: profile.id, bottles: qty, collected_on: date, photo_url,
      });
      if (error && !error.message.includes('submissions_request_id_key')) throw error;
      requestId.current = uuid();
      setPhoto(null);
      setQty(20);
      notify(t('common.success'), t('submit.sent'));
      reload();
    } catch (e) {
      notify(t('common.error'), t(errKey(e)));
    } finally { setBusy(false); }
  }

  const step = (d: number) => setQty((q) => Math.max(1, Math.min(500, (q || 0) + d)));

  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={C.primary} />}>
      <Hero title={t('submit.title')} subtitle={t('submit.subtitle')} right={<Icon name="recycle" size={40} color="rgba(255,255,255,0.9)" />} />
      <View style={s.body}>
        <FadeIn>
          <Card style={{ padding: 20 }}>
            <Text style={{ fontWeight: '700', color: C.text, marginBottom: 12 }}>{t('submit.quantity')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <RoundBtn icon="minus" onPress={() => step(-1)} onLong={() => step(-10)} />
              <View style={{ alignItems: 'center', minWidth: 110 }}>
                <TextInput value={String(qty)} onChangeText={(v) => setQty(parseInt(v.replace(/\D/g, '') || '0', 10))}
                  keyboardType="number-pad" maxLength={3}
                  style={{ fontSize: 52, fontWeight: '900', color: C.text, textAlign: 'center', minWidth: 110, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }} />
                <Text style={{ color: C.muted, marginTop: -4 }}>{t('common.bottles')}</Text>
              </View>
              <RoundBtn icon="plus" onPress={() => step(1)} onLong={() => step(10)} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {[10, 20, 50, 100].map((n) => (
                <Pressable key={n} onPress={() => setQty(n)}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: qty === n ? C.primary : C.light }}>
                  <Text style={{ fontWeight: '700', color: qty === n ? C.white : C.primaryDark }}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: C.mint, borderRadius: R.md, padding: 14, gap: 10 }}>
              <Estimate icon="star-four-points-outline" value={`+${qty || 0}`} label={t('home.points')} />
              <Estimate icon="weight-kilogram" value={`≈ ${kg(qty || 0)}`} label="kg" />
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={100}>
          <Card style={{ marginTop: 14 }}>
            <Input label={t('submit.date')} icon="calendar-outline" value={date} onChangeText={setDate} placeholder="2026-11-18" maxLength={10} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ d: 0, l: t('submit.today') }, { d: -1, l: t('submit.yesterday') }].map((o) => (
                <Pressable key={o.d} onPress={() => setDate(isoDay(o.d))}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: date === isoDay(o.d) ? C.primary : C.light }}>
                  <Text style={{ fontWeight: '700', fontSize: 12, color: date === isoDay(o.d) ? C.white : C.primaryDark }}>{o.l}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontWeight: '600', color: C.text, marginTop: 18, marginBottom: 8, fontSize: 13 }}>{t('submit.photo')}</Text>
            {photo ? (
              <View>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 190, borderRadius: R.md }} />
                <Button small variant="ghost" icon="trash-can-outline" title={t('submit.remove_photo')} onPress={() => setPhoto(null)} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => pick(false)} style={photoBox}>
                  <Icon name="image-plus" size={28} /><Text style={{ color: C.primaryDark, fontWeight: '600', marginTop: 4 }}>{t('submit.add_photo')}</Text>
                </Pressable>
                {Platform.OS !== 'web' && (
                  <Pressable onPress={() => pick(true)} style={photoBox}>
                    <Icon name="camera-outline" size={28} /><Text style={{ color: C.primaryDark, fontWeight: '600', marginTop: 4 }}>{t('submit.take_photo')}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        </FadeIn>

        <Button title={t('submit.send')} icon="send-outline" onPress={send} loading={busy} style={{ marginTop: 16 }} />

        <SectionTitle>{t('submit.history')}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {history.length === 0 ? <Empty text={t('home.no_activity')} /> : history.map((h, i) => (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: C.border }}>
              {h.photo_url
                ? <Image source={{ uri: h.photo_url }} style={{ width: 44, height: 44, borderRadius: 12 }} />
                : <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' }}><Icon name="bottle-soda-outline" /></View>}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.text }}>{h.bottles} {t('common.bottles')} • {kg(h.bottles)} kg</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{fmtDate(h.collected_on, locale)}</Text>
                {h.admin_note ? <Text style={{ color: C.muted, fontSize: 12, fontStyle: 'italic' }}>“{h.admin_note}”</Text> : null}
              </View>
              <StatusBadge status={h.status} />
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  );
}

const photoBox = { flex: 1, height: 100, borderRadius: R.md, borderWidth: 2, borderStyle: 'dashed' as const, borderColor: '#A7E3BC', backgroundColor: C.mint, alignItems: 'center' as const, justifyContent: 'center' as const };

function RoundBtn({ icon, onPress, onLong }: { icon: string; onPress: () => void; onLong: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLong}
      style={({ pressed }) => ({ width: 52, height: 52, borderRadius: 26, backgroundColor: pressed ? C.primary : C.light, alignItems: 'center', justifyContent: 'center' })}>
      {({ pressed }) => <Icon name={icon} size={26} color={pressed ? C.white : C.primaryDark} />}
    </Pressable>
  );
}

function Estimate({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} />
      <View>
        <Text style={{ fontWeight: '900', fontSize: 18, color: C.text }}>{value}</Text>
        <Text style={{ fontSize: 11, color: C.muted }}>{label}</Text>
      </View>
    </View>
  );
}
