import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { C } from '../theme';

export function LangToggle({ dark }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  const bg = dark ? C.light : 'rgba(255,255,255,0.2)';
  return (
    <View style={{ flexDirection: 'row', backgroundColor: bg, borderRadius: 20, padding: 3 }}>
      {(['kk', 'ru'] as const).map((l) => (
        <Pressable key={l} onPress={() => setLang(l)}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: lang === l ? C.white : 'transparent' }}>
          <Text style={{ fontWeight: '800', fontSize: 12, color: lang === l ? C.primaryDark : dark ? C.muted : C.white }}>
            {l === 'kk' ? 'ҚАЗ' : 'РУС'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
