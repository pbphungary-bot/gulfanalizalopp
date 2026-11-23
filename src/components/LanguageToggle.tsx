import React from 'react';
import { Pressable, Text } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

/** Small EN / HU switch. Shows the language you would switch to. */
export function LanguageToggle() {
  const { c } = useTheme();
  const { lang, setLang, t } = useI18n();
  const next = lang === 'en' ? 'hu' : 'en';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('lang.switch')}
      onPress={() => setLang(next)}
      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: c.accent, letterSpacing: 1 }}>{next.toUpperCase()}</Text>
    </Pressable>
  );
}
