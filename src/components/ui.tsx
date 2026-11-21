import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette, space, TAP, useTheme } from '../theme';

export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= 768;
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: space.lg, paddingBottom: 48, gap: space.md },
    scrollTablet: { alignSelf: 'center', width: '100%', maxWidth: 900, padding: space.xl },
    card: { backgroundColor: c.card, borderRadius: 20, padding: space.lg, borderWidth: 1, borderColor: c.line, gap: space.sm },
    h1: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    h2: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { fontSize: 16, color: c.text, lineHeight: 22 },
    label: { fontSize: 13, fontWeight: '600', color: c.muted, marginBottom: space.xs },
    eyebrow: { fontSize: 12, fontWeight: '800', color: c.muted, letterSpacing: 1.6, textTransform: 'uppercase' },
    input: { minHeight: TAP, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: space.md, fontSize: 18, color: c.text, backgroundColor: c.cardAlt },
    button: { minHeight: TAP, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
    buttonText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.8 },
    chip: { minHeight: 44, paddingHorizontal: space.md, borderRadius: 22, borderWidth: 1, borderColor: c.line, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' },
    chipText: { fontSize: 15, fontWeight: '600', color: c.text },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  });
}

export function useStyles() {
  const { c } = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}

/** Scrollable screen that centers a max-width column on tablets. */
export function Screen({ children }: { children: React.ReactNode }) {
  const tablet = useIsTablet();
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scroll, tablet && styles.scrollTablet]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={useStyles().h1}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={useStyles().h2}>{children}</Text>;
}
/** Small uppercase label, used above headings and on stat cards. */
export function Eyebrow({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  const { c } = useTheme();
  return <Text style={[useStyles().eyebrow, accent && { color: c.accent }]}>{children}</Text>;
}
export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  const { c } = useTheme();
  return <Text style={[useStyles().body, muted && { color: c.muted }, style]}>{children}</Text>;
}

export function Button({
  label, onPress, variant = 'primary', disabled, flex,
}: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; flex?: boolean }) {
  const { c } = useTheme();
  const styles = useStyles();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.bad : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'danger' ? '#FFFFFF' : c.accent;
  const border = variant === 'secondary' ? c.accent : bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        flex && { flex: 1 },
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: c.primary, borderColor: c.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: c.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={useStyles().chipRow}>{children}</View>;
}

export function Field({
  label, value, onChangeText, keyboardType, placeholder,
}: { label: string; value: string; onChangeText: (t: string) => void; keyboardType?: 'default' | 'numeric' | 'decimal-pad'; placeholder?: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        style={styles.input}
      />
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>{children}</View>;
}

export function SgValue({ value, size = 18 }: { value: number; size?: number }) {
  const { c } = useTheme();
  const color = value > 0.05 ? c.good : value < -0.05 ? c.bad : c.muted;
  return <Text style={{ color, fontWeight: '800', fontSize: size }}>{value > 0 ? '+' : ''}{value.toFixed(2)}</Text>;
}

/** Compact metric tile for the dashboard: label, big value, small footnote. */
export function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.card, { flexGrow: 1, flexBasis: '45%', gap: 4, padding: space.md }]}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={{ fontSize: 30, fontWeight: '800', color: c.text, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: c.muted }}>{note}</Text>
    </View>
  );
}
