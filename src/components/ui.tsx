import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Alert, Animated, Platform, Pressable, StyleProp, StyleSheet, Text,
  TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Rect, Stop, LinearGradient as SvgGrad, Text as SvgText } from 'react-native-svg';
import { useI18n } from '../i18n';
import { Status } from '../lib/supabase';
import { C, grad, R, shadow } from '../theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export const Icon = ({ name, size = 22, color = C.primary }: { name: string; size?: number; color?: string }) =>
  <MaterialCommunityIcons name={name as IconName} size={size} color={color} />;

/** Cross-platform alert (Alert.alert is a no-op on web). */
export function notify(title: string, msg?: string) {
  if (Platform.OS === 'web') window.alert(msg ? `${title}\n\n${msg}` : title);
  else Alert.alert(title, msg);
}
export function confirm(title: string, msg: string, okText: string, cancelText: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${msg}`));
  return new Promise((res) => Alert.alert(title, msg, [
    { text: cancelText, style: 'cancel', onPress: () => res(false) },
    { text: okText, onPress: () => res(true) },
  ]));
}

/** Fades + slides children in on mount. */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 450, delay, useNativeDriver: Platform.OS !== 'web' }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export function Hero({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={grad.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[s.hero, { paddingTop: insets.top + 18 }]}>
      <View style={s.leaf1}><Icon name="leaf" size={140} color="rgba(255,255,255,0.08)" /></View>
      <View style={s.leaf2}><Icon name="recycle" size={90} color="rgba(255,255,255,0.08)" /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>{title}</Text>
          {subtitle ? <Text style={s.heroSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style, small }: {
  title: string; onPress: () => void; icon?: string; variant?: 'primary' | 'ghost' | 'danger' | 'light';
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40 }).start();
  const fg = variant === 'primary' || variant === 'danger' ? C.white : variant === 'light' ? C.primaryDark : C.primary;
  const inner = (
    <View style={[s.btnInner, small && { paddingVertical: 9, paddingHorizontal: 14 }]}>
      {loading ? <ActivityIndicator color={fg} /> : <>
        {icon ? <Icon name={icon} size={small ? 16 : 20} color={fg} /> : null}
        <Text style={[s.btnText, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
      </>}
    </View>
  );
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.5 : 1 }, style]}>
      <Pressable onPress={onPress} disabled={disabled || loading} onPressIn={() => to(0.96)} onPressOut={() => to(1)}
        style={[s.btn,
          variant === 'ghost' && { backgroundColor: C.light },
          variant === 'light' && { backgroundColor: C.white },
          variant === 'danger' && { backgroundColor: C.danger }]}>
        {variant === 'primary'
          ? <LinearGradient colors={[C.primary, C.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>{inner}</LinearGradient>
          : inner}
      </Pressable>
    </Animated.View>
  );
}

export function Input({ label, icon, ...p }: TextInputProps & { label?: string; icon?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.inputWrap}>
        {icon ? <Icon name={icon} size={20} color={C.muted} /> : null}
        <TextInput placeholderTextColor="#9DB0A4" style={s.input} {...p} />
      </View>
    </View>
  );
}

export function StatTile({ icon, value, label, tint = C.primary, style }: { icon: string; value: string | number; label: string; tint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[{ flex: 1, padding: 14 }, style]}>
      <View style={[s.iconBubble, { backgroundColor: tint + '1A' }]}><Icon name={icon} size={20} color={tint} /></View>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </Card>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  const map = {
    pending: { bg: C.warnBg, fg: C.warn, icon: 'clock-outline' },
    approved: { bg: C.light, fg: C.primaryDark, icon: 'check-circle-outline' },
    rejected: { bg: C.dangerBg, fg: C.danger, icon: 'close-circle-outline' },
  }[status];
  return (
    <View style={[s.badge, { backgroundColor: map.bg }]}>
      <Icon name={map.icon} size={13} color={map.fg} />
      <Text style={[s.badgeText, { color: map.fg }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, value === o.value && s.segActive]}>
          <Text style={[s.segText, value === o.value && { color: C.primaryDark }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Empty({ icon = 'sprout', text }: { icon?: string; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 28 }}>
      <View style={[s.iconBubble, { width: 64, height: 64, borderRadius: 32, backgroundColor: C.light }]}><Icon name={icon} size={32} /></View>
      <Text style={{ color: C.muted, textAlign: 'center', marginTop: 10 }}>{text}</Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
      <Text style={s.section}>{children}</Text>
      {right}
    </View>
  );
}

/** Animated circular progress ring. */
export function ProgressRing({ value, max, size = 120, stroke = 12, label, sub }: { value: number; max: number; size?: number; stroke?: number; label: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGrad id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#4ADE80" /><Stop offset="1" stopColor={C.primaryDark} />
          </SvgGrad>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.light} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ring)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" />
      </Svg>
      <Text style={{ fontSize: size / 5, fontWeight: '800', color: C.text }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 11, color: C.muted }}>{sub}</Text> : null}
    </View>
  );
}

/** Simple responsive bar chart drawn with SVG. */
export function BarChart({ data, height = 170 }: { data: { label: string; value: number }[]; height?: number }) {
  const [w, setW] = React.useState(300);
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = 12;
  const bw = data.length ? (w - gap * (data.length - 1)) / data.length : 0;
  const chartH = height - 34;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={height}>
        <Defs>
          <SvgGrad id="bar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4ADE80" /><Stop offset="1" stopColor={C.primaryDark} />
          </SvgGrad>
        </Defs>
        {data.map((d, i) => {
          const h = Math.max(4, (d.value / max) * (chartH - 16));
          const x = i * (bw + gap);
          const y = chartH - h;
          return (
            <React.Fragment key={d.label + i}>
              <Rect x={x} y={0} width={bw} height={chartH} rx={10} fill={C.mint} />
              <Rect x={x} y={y} width={bw} height={h} rx={10} fill="url(#bar)" />
              <SvgText x={x + bw / 2} y={y - 5} fontSize="11" fontWeight="700" fill={C.text} textAnchor="middle">{d.value}</SvgText>
              <SvgText x={x + bw / 2} y={height - 10} fontSize="11" fill={C.muted} textAnchor="middle">{d.label}</SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export function ProgressBar({ pct, color = C.primary }: { pct: number; color?: string }) {
  return (
    <View style={{ height: 8, backgroundColor: C.light, borderRadius: 8, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%`, height: '100%', backgroundColor: color, borderRadius: 8 }} />
    </View>
  );
}

export const Loading = () => <View style={{ padding: 40 }}><ActivityIndicator color={C.primary} size="large" /></View>;

export const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl, overflow: 'hidden' },
  leaf1: { position: 'absolute', right: -30, top: -10, transform: [{ rotate: '25deg' }] },
  leaf2: { position: 'absolute', left: -20, bottom: -20 },
  heroTitle: { color: C.white, fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  card: { backgroundColor: C.white, borderRadius: R.lg, padding: 16, ...shadow },
  btn: { borderRadius: R.md, overflow: 'hidden', backgroundColor: C.primary },
  btnGrad: { borderRadius: R.md },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 18 },
  btnText: { fontWeight: '700', fontSize: 15 },
  label: { color: C.text, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  inputWrap: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.mint, borderRadius: R.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  input: { flex: 1, minWidth: 0, width: '100%', paddingVertical: 13, fontSize: 15, color: C.text, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) },
  iconBubble: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: C.text, marginTop: 10 },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  seg: { flexDirection: 'row', backgroundColor: C.light, borderRadius: R.md, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  segActive: { backgroundColor: C.white, ...shadow, shadowOpacity: 0.06 },
  segText: { fontWeight: '700', color: C.muted, fontSize: 13 },
  section: { flex: 1, fontSize: 18, fontWeight: '800', color: C.text },
  row: { flexDirection: 'row', alignItems: 'center' },
  screen: { flex: 1, backgroundColor: C.bg },
  body: { padding: 16, paddingBottom: 40 },
});
