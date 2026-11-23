import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H2, Screen } from '../components/ui';
import { deleteCourse, getCourse, saveCourse } from '../db/courses';
import { Course, Gender, Rating, Tee, TEE_COLORS, TeeColor, validateCourse } from '../domain/courses';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { space, TAP, useTheme } from '../theme';
import { useLoad } from '../useLoad';

interface TeeForm {
  color: TeeColor;
  men: { cr: string; sr: string };
  women: { cr: string; sr: string };
  lengths: string[];
}
interface HoleForm { par: string; si: string }

const emptyTee = (color: TeeColor, holes: number): TeeForm => ({
  color, men: { cr: '', sr: '' }, women: { cr: '', sr: '' }, lengths: Array(holes).fill(''),
});

/** Small input for the hole table. */
function Cell({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 64 }}>
      <Text style={{ fontSize: 11, color: c.muted, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={{ minHeight: TAP, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: space.sm, fontSize: 16, color: c.text, backgroundColor: c.cardAlt }}
      />
    </View>
  );
}

export function AddCourse() {
  const { t, tm, unitLong, parseLen, lenNum } = useI18n();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParams, 'AddCourse'>>();
  const editing = params?.courseId;
  const [name, setName] = useState('');
  const [n, setN] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<HoleForm[]>(Array.from({ length: 18 }, (_, i) => ({ par: '4', si: String(i + 1) })));
  const [tees, setTees] = useState<TeeForm[]>([emptyTee('white', 18)]);
  const [loaded, setLoaded] = useState(false);

  useLoad(async () => {
    if (!editing || loaded) return null;
    const c = await getCourse(editing);
    if (c) {
      setName(c.name);
      setN(c.holes.length as 9 | 18);
      setHoles(c.holes.map((h) => ({ par: String(h.par), si: String(h.si) })));
      setTees(c.tees.map((tee) => ({
        color: tee.color,
        men: { cr: String(tee.ratings.find((r) => r.gender === 'men')?.cr ?? ''), sr: String(tee.ratings.find((r) => r.gender === 'men')?.sr ?? '') },
        women: { cr: String(tee.ratings.find((r) => r.gender === 'women')?.cr ?? ''), sr: String(tee.ratings.find((r) => r.gender === 'women')?.sr ?? '') },
        lengths: tee.lengths.map((l) => String(Math.round(lenNum(l)))),
      })));
    }
    setLoaded(true);
    return c;
  }, [editing]);

  const setCount = (count: 9 | 18) => {
    setN(count);
    setHoles((h) => (count <= h.length ? h.slice(0, count) : [...h, ...Array.from({ length: count - h.length }, (_, i) => ({ par: '4', si: String(h.length + i + 1) }))]));
    setTees((ts) => ts.map((x) => ({ ...x, lengths: count <= x.lengths.length ? x.lengths.slice(0, count) : [...x.lengths, ...Array(count - x.lengths.length).fill('')] })));
  };

  const num = (s: string) => parseFloat(s.trim().replace(',', '.'));
  const ratingList = (f: { cr: string; sr: string }, gender: Gender): Rating[] =>
    f.cr.trim() === '' && f.sr.trim() === '' ? [] : [{ gender, cr: num(f.cr), sr: num(f.sr) }];

  const build = (): Course => ({
    id: editing ?? `custom-${Date.now()}`,
    name,
    holes: holes.map((h) => ({ par: num(h.par), si: num(h.si) })),
    tees: tees.map((f, i): Tee => ({
      id: `${f.color}-${i}`,
      color: f.color,
      ratings: [...ratingList(f.men, 'men'), ...ratingList(f.women, 'women')],
      lengths: f.lengths.map((l) => Math.round(parseLen(l) * 10) / 10),
    })),
  });

  const save = async () => {
    const course = build();
    const errors = validateCourse(course);
    if (errors.length) {
      Alert.alert(t('course.fixTitle'), errors.slice(0, 4).map(tm).join('\n'));
      return;
    }
    await saveCourse(course);
    nav.goBack();
  };

  const remove = () =>
    Alert.alert(t('course.deleteTitle'), t('course.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { if (editing) await deleteCourse(editing); nav.goBack(); } },
    ]);

  const patchTee = (i: number, patch: Partial<TeeForm>) => setTees((ts) => ts.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <Screen>
      <Card>
        <H2>{t('course.new')}</H2>
        <Field label={t('course.name')} value={name} onChangeText={setName} />
        <Body muted>{t('course.holesCount')}</Body>
        <ChipRow>
          <Chip label="18" selected={n === 18} onPress={() => setCount(18)} />
          <Chip label="9" selected={n === 9} onPress={() => setCount(9)} />
        </ChipRow>
      </Card>

      <Card>
        <H2>{t('course.teesTitle')}</H2>
        <Body muted>{t('course.ratingHint')}</Body>
        {tees.map((f, i) => (
          <View key={i} style={{ gap: space.sm, paddingVertical: space.sm }}>
            <ChipRow>
              {TEE_COLORS.map((col) => (
                <Chip key={col} label={t(`tee.${col}`)} selected={f.color === col} onPress={() => patchTee(i, { color: col })} />
              ))}
            </ChipRow>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Cell label={t('course.crMen')} value={f.men.cr} onChange={(v) => patchTee(i, { men: { ...f.men, cr: v } })} />
              <Cell label={t('course.srMen')} value={f.men.sr} onChange={(v) => patchTee(i, { men: { ...f.men, sr: v } })} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Cell label={t('course.crWomen')} value={f.women.cr} onChange={(v) => patchTee(i, { women: { ...f.women, cr: v } })} />
              <Cell label={t('course.srWomen')} value={f.women.sr} onChange={(v) => patchTee(i, { women: { ...f.women, sr: v } })} />
            </View>
            {tees.length > 1 && <Button label={t('course.removeTee')} variant="secondary" onPress={() => setTees((ts) => ts.filter((_, k) => k !== i))} />}
          </View>
        ))}
        <Button label={t('course.addTee')} variant="secondary" onPress={() => setTees((ts) => [...ts, emptyTee('yellow', n)])} />
      </Card>

      <Card>
        <H2>{t('course.holesTitle')}</H2>
        {holes.map((h, i) => (
          <View key={i} style={{ gap: space.xs, paddingVertical: space.xs }}>
            <Body style={{ fontWeight: '700' }}>{t('course.holeN', { n: i + 1 })}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Cell label={t('course.par')} value={h.par} onChange={(v) => setHoles((hs) => hs.map((x, k) => (k === i ? { ...x, par: v } : x)))} />
              <Cell label={t('course.si')} value={h.si} onChange={(v) => setHoles((hs) => hs.map((x, k) => (k === i ? { ...x, si: v } : x)))} />
              {tees.map((f, ti) => (
                <Cell
                  key={ti}
                  label={`${t(`tee.${f.color}`)} (${unitLong})`}
                  value={f.lengths[i] ?? ''}
                  onChange={(v) => patchTee(ti, { lengths: f.lengths.map((l, k) => (k === i ? v : l)) })}
                />
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Button label={t('course.save')} onPress={save} />
      {editing && <Button label={t('course.delete')} variant="danger" onPress={remove} />}
    </Screen>
  );
}
