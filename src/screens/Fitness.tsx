import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, Vibration, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Eyebrow, H1, H2, Row, Screen } from '../components/ui';
import { getPlan } from '../db';
import { deleteGymSet, GymSet, lastSessionSets, localDay, logGymSet, sessionsSince, setsToday } from '../db/gym';
import { GYM_SAFETY_NOTE, GYM_TEMPLATES, GymExercise, GymTemplateKey } from '../domain/gym';
import { formatSets, suggestNext } from '../domain/progression';
import { startOfWeek } from '../domain/stats';
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
  const suggestion = suggestNext(ex, last);
  const done = today.length >= ex.sets;
  const box = {
    minHeight: TAP, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: space.md,
    fontSize: 18, color: c.text, backgroundColor: c.cardAlt, flex: 1, minWidth: 80,
  } as const;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H2>{ex.name}</H2>
        <Text style={{ color: c.muted }}>{ex.prescription}</Text>
      </Row>
      <Text style={{ color: c.muted, fontSize: 13 }}>
        {last.length ? `Last time: ${formatSets(last)}` : 'Not logged before'}
      </Text>
      <Text style={{ color: c.text, fontSize: 14 }}>{suggestion.text}</Text>

      {today.map((s) => (
        <Row key={s.id} style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.good, fontWeight: '700' }}>
            ✓ Set {s.setNo}: {s.weight !== null ? `${s.weight} kg × ` : ''}{s.reps} reps
          </Text>
          <Pressable
            accessibilityRole="button" accessibilityLabel={`Delete set ${s.setNo}`} onPress={() => onDelete(s.id)}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: c.bad, fontSize: 18 }}>✕</Text>
          </Pressable>
        </Row>
      ))}

      <Row>
        {ex.kind === 'weight' && (
          <TextInput
            accessibilityLabel={`${ex.name} weight in kilograms`}
            value={inputs.w} onChangeText={(w) => onChange({ ...inputs, w })}
            keyboardType="decimal-pad" placeholder="kg" placeholderTextColor={c.muted} style={box}
          />
        )}
        <TextInput
          accessibilityLabel={`${ex.name} reps`}
          value={inputs.r} onChangeText={(r) => onChange({ ...inputs, r })}
          keyboardType="numeric" placeholder="reps" placeholderTextColor={c.muted} style={box}
        />
      </Row>
      <Button label={done ? `LOG EXTRA SET` : `LOG SET ${today.length + 1} OF ${ex.sets}`} onPress={onLog} variant={done ? 'secondary' : 'primary'} />
    </Card>
  );
}

export function Fitness() {
  const { c } = useTheme();
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
    const weight = ex.kind === 'weight' ? parseFloat(inp.w) : null;
    if (Number.isNaN(reps) || reps < 1 || reps > 100) {
      Alert.alert('Check the reps', 'Enter how many reps you did, between 1 and 100.');
      return;
    }
    if (ex.kind === 'weight' && (weight === null || Number.isNaN(weight) || weight <= 0 || weight > 500)) {
      Alert.alert('Check the weight', 'Enter the weight in kilograms, for example 60 or 22.5.');
      return;
    }
    await logGymSet({ exerciseId: ex.id, template, setNo: (per?.today.length ?? 0) + 1, weight, reps });
    setInputs({ ...inputs, [ex.id]: inp });
    if (ex.kind !== 'bodyweight') startRest(lastRest.current);
    reload();
  };

  const remove = (id: number) =>
    Alert.alert('Delete this set?', 'This removes it from your log.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGymSet(id); reload(); } },
    ]);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Eyebrow accent>{tpl.title}</Eyebrow>
        <H1>Fitness</H1>
        <Body muted>{tpl.note}</Body>
      </View>

      <ChipRow>
        {TEMPLATE_KEYS.map((k) => (
          <Chip key={k} label={GYM_TEMPLATES[k].title} selected={template === k} onPress={() => setTemplate(k)} />
        ))}
      </ChipRow>

      <Card>
        <Eyebrow>Rest timer</Eyebrow>
        <Text style={{ fontSize: 40, fontWeight: '800', color: rest && rest.left > 0 ? c.text : c.muted }}>
          {mmss(rest ? Math.max(rest.left, 0) : lastRest.current)}
        </Text>
        {rest && rest.left <= 0 && <Text style={{ color: c.good, fontWeight: '700' }}>Rest over. Next set.</Text>}
        <ChipRow>
          {[60, 90, 120].map((s) => (
            <Chip key={s} label={`Start ${s}s`} onPress={() => startRest(s)} />
          ))}
          {rest && <Chip label="Stop" onPress={() => setRest(null)} />}
        </ChipRow>
        <Body muted style={{ fontSize: 12 }}>The timer starts by itself after each set you log, using the last length you chose.</Body>
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
        <Eyebrow>This week</Eyebrow>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Gym sessions logged</Body>
          <Body muted>{data ? `${data.done}${plannedGym ? ` of ${plannedGym} planned` : ''}` : '–'}</Body>
        </Row>
      </Card>
      <Body muted style={{ fontSize: 12 }}>{GYM_SAFETY_NOTE}</Body>
    </Screen>
  );
}
