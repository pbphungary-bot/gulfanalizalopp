import React from 'react';
import { Pressable, Text } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

/** Switches between metres and yards. Shows the unit you would switch to. */
export function UnitsToggle() {
  const { c } = useTheme();
  const { system, setSystem, t } = useI18n();
  const next = system === 'metric' ? 'imperial' : 'metric';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('units.switch')}
      onPress={() => setSystem(next)}
      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: c.accent, letterSpacing: 1 }}>{next === 'metric' ? 'M' : 'YD'}</Text>
    </Pressable>
  );
}
