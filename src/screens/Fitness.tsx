import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, Vibration, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Eyebrow, H1, H2, Row, Screen } from '../components/ui';
import { getPlan } from '../db';
import { deleteGymSet, GymSet, lastSessionSets, localDay, logGymSet, sessionsSince, setsToday } from '../db/gym';
import { GYM_TEMPLATES, GymExercise, GymTemplateKey, prescription } from '../domain/gym';
import { formatSets, suggestNext } from '../domain/progression';
import { startOfWeek } from '../domain/stats';
import { useI18n } from '../i18n';
import { space, TAP, useTheme } from '../theme';
import { useLoad } from '../useLoad';

const TEMPLATE_KEYS: GymTemplateKey[] = ['strength', 'power', 'mobility'];
const todayIndex = () => (new Date().getDay() + 6) % 7;

interface Inputs { w: string; r: string }

function ExerciseCard({
  ex, today, last, inputs, onChange, onLog, onDelete,
}: {
  ex: GymExercise; today: GymSet[]; last: GymSet[]; inputs: Inputs;
  onChange: (next: Inputs) => void; onLog: () => void; onDelete: (id: number) => void;
}) {
  const { c } = useTheme();
  const { t, tm } = useI18n();
  const name = t(`gym.ex.${ex.id}`);
  const suggestion = suggestNext(ex, last);
  const done = today.length >= ex.sets;
  const box = {
    minHeight: TAP, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: space.md,
    fontSize: 18, color: c.text, backgroundColor: c.cardAlt, flex: 1, minWidth: 80,
  } as const;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H2>{name}</H2>
        <Text style={{ color: c.muted }}>{prescription(ex, t)}</Text>
      </Row>
      <Text style={{ color: c.muted, fontSize: 13 }}>
        {last.length ? t('fit.last', { sets: formatSets(last, t) }) : t('fit.never')}
      </Text>
      <Text style={{ color: c.text, fontSize: 14 }}>{tm(suggestion.msg)}</Text>

      {today.map((s) => (
        <Row key={s.id} style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.good, fontWeight: '700' }}>
            ✓ {s.weight !== null ? t('fit.setW', { n: s.setNo, w: s.weight, r: s.reps }) : t('fit.set', { n: s.setNo, r: s.reps })}
          </Text>
          <Pressable
            accessibilityRole="button" accessibilityLabel={t('fit.delSetLabel', { n: s.setNo })} onPress={() => onDelete(s.id)}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: c.bad, fontSize: 18 }}>✕</Text>
          </Pressable>
        </Row>
      ))}

      <Row>
        {ex.kind === 'weight' && (
          <TextInput
            accessibilityLabel={t('fit.weightLabel', { name })}
            value={inputs.w} onChangeText={(w) => onChange({ ...inputs, w })}
            keyboardType="decimal-pad" placeholder={t('unit.kg')} placeholderTextColor={c.muted} style={box}
          />
        )}
        <TextInput
          accessibilityLabel={t('fit.repsLabel', { name })}
          value={inputs.r} onChangeText={(r) => onChange({ ...inputs, r })}
          keyboardType="numeric" placeholder={t('fit.reps')} placeholderTextColor={c.muted} style={box}
        />
      </Row>
      <Button label={done ? t('fit.logExtra') : t('fit.logSet', { n: today.length + 1, total: ex.sets })} onPress={onLog} variant={done ? 'secondary' : 'primary'} />
    </Card>
  );
}

export function Fitness() {
  const { c } = useTheme();
  const { t } = useI18n();
  const [template, setTemplate] = useState<GymTemplateKey>('strength');
  const [inputs, setInputs] = useState<Record<string, Inputs>>({});
  const picked = useRef(false);

  const { data, reload } = useLoad(async () => {
    const plan = await getPlan();
    const exercises = GYM_TEMPLATES[template].exercises;
    const per = await Promise.all(exercises.map(async (e) => ({ id: e.id, today: await setsToday(e.id), last: await lastSessionSets(e.id) })));
    const done = await sessionsSince(localDay(startOfWeek()));
    return { plan, per, done };
  }, [template]);

  // The first time the plan loads, open today's planned gym workout if there is one.
  useEffect(() => {
    if (picked.current || !data?.plan) return;
    picked.current = true;
    const todays = data.plan.sessions.find((s) => s.kind === 'gym' && s.day === todayIndex());
    if (todays?.gymTemplate) setTemplate(todays.gymTemplate);
  }, [data]);

  // Rest timer
  const [rest, setRest] = useState<{ left: number; total: number } | null>(null);
  const lastRest = useRef(90);
  useEffect(() => {
    if (!rest || rest.left <= 0) return;
    const t = setTimeout(() => {
      const left = rest.left - 1;
      if (left <= 0) Vibration.vibrate(500);
      setRest({ left, total: rest.total });
    }, 1000);
    return () => clearTimeout(t);
  }, [rest]);
  const startRest = (sec: number) => { lastRest.current = sec; setRest({ left: sec, total: sec }); };
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const plannedGym = data?.plan?.sessions.filter((s) => s.kind === 'gym').length ?? 0;
  const tpl = GYM_TEMPLATES[template];

  const log = async (ex: GymExercise) => {
    const per = data?.per.find((p) => p.id === ex.id);
    const suggestion = suggestNext(ex, per?.last ?? null);
    const inp = inputs[ex.id] ?? { w: suggestion.weight !== null ? String(suggestion.weight) : '', r: String(ex.repsLow) };
    const reps = parseInt(inp.r, 10);
    const weight = ex.kind === 'weight' ? parseFloat(inp.w.replace(',', '.')) : null;
    if (Number.isNaN(reps) || reps < 1 || reps > 100) {
      Alert.alert(t('fit.errRepsTitle'), t('fit.errRepsBody'));
      return;
    }
    if (ex.kind === 'weight' && (weight === null || Number.isNaN(weight) || weight <= 0 || weight > 500)) {
      Alert.alert(t('fit.errWeightTitle'), t('fit.errWeightBody'));
      return;
    }
    await logGymSet({ exerciseId: ex.id, template, setNo: (per?.today.length ?? 0) + 1, weight, reps });
    setInputs({ ...inputs, [ex.id]: inp });
    if (ex.kind !== 'bodyweight') startRest(lastRest.current);
    reload();
  };

  const remove = (id: number) =>
    Alert.alert(t('fit.delTitle'), t('fit.delBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteGymSet(id); reload(); } },
    ]);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow accent>{t(`gym.tpl.${template}.title`)}</Eyebrow>
        <H1>{t('fit.title')}</H1>
        <Body muted>{t(`gym.tpl.${template}.note`)}</Body>
      </View>

      <ChipRow>
        {TEMPLATE_KEYS.map((k) => (
          <Chip key={k} label={t(`gym.tpl.${k}.title`)} selected={template === k} onPress={() => setTemplate(k)} />
        ))}
      </ChipRow>

      <Card>
        <Eyebrow>{t('fit.restTimer')}</Eyebrow>
        <Text style={{ fontSize: 40, fontWeight: '800', color: rest && rest.left > 0 ? c.text : c.muted }}>
          {mmss(rest ? Math.max(rest.left, 0) : lastRest.current)}
        </Text>
        {rest && rest.left <= 0 && <Text style={{ color: c.good, fontWeight: '700' }}>{t('fit.over')}</Text>}
        <ChipRow>
          {[60, 90, 120].map((s) => (
            <Chip key={s} label={t('fit.start', { n: s })} onPress={() => startRest(s)} />
          ))}
          {rest && <Chip label={t('fit.stop')} onPress={() => setRest(null)} />}
        </ChipRow>
        <Body muted style={{ fontSize: 12 }}>{t('fit.timerNote')}</Body>
      </Card>

      {tpl.exercises.map((ex) => {
        const per = data?.per.find((p) => p.id === ex.id);
        const sug = suggestNext(ex, per?.last ?? null);
        const inp = inputs[ex.id] ?? { w: sug.weight !== null ? String(sug.weight) : '', r: String(ex.repsLow) };
        return (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            today={per?.today ?? []}
            last={per?.last ?? []}
            inputs={inp}
            onChange={(next) => setInputs({ ...inputs, [ex.id]: next })}
            onLog={() => log(ex)}
            onDelete={remove}
          />
        );
      })}

      <Card>
        <Eyebrow>{t('home.thisWeek')}</Eyebrow>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>{t('fit.sessions')}</Body>
          <Body muted>{data ? (plannedGym ? t('fit.ofPlanned', { n: data.done, m: plannedGym }) : String(data.done)) : '–'}</Body>
        </Row>
      </Card>
      <Body muted style={{ fontSize: 12 }}>{t('gym.safety')}</Body>
    </Screen>
  );
}
