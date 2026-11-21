import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, TAP } from '../theme';

export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= 768;
}

/** Scrollable screen that centers a max-width column on tablets. */
export function Screen({ children }: { children: React.ReactNode }) {
  const tablet = useIsTablet();
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}
export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && { color: colors.muted }, style]}>{children}</Text>;
}

export function Button({
  label, onPress, variant = 'primary', disabled,
}: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.bad : 'transparent';
  const fg = variant === 'secondary' ? colors.primary : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? colors.primary : bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Field({
  label, value, onChangeText, keyboardType, placeholder,
}: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric' | 'decimal-pad'; placeholder?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>{children}</View>;
}

export function SgValue({ value, size = 18 }: { value: number; size?: number }) {
  const color = value > 0.05 ? colors.good : value < -0.05 ? colors.bad : colors.muted;
  return <Text style={{ color, fontWeight: '700', fontSize: size }}>{value > 0 ? '+' : ''}{value.toFixed(2)}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: 48, gap: space.md },
  scrollTablet: { alignSelf: 'center', width: '100%', maxWidth: 820, padding: space.xl },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: space.lg, borderWidth: 1, borderColor: colors.line, gap: space.sm },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted, marginBottom: space.xs },
  input: { minHeight: TAP, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: space.md, fontSize: 18, color: colors.text, backgroundColor: colors.card },
  button: { minHeight: TAP, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: 17, fontWeight: '700' },
  chip: { minHeight: 44, paddingHorizontal: space.md, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
