import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, H1, H2, Row, Screen } from '../components/ui';
import { getPlan, listDrillLogs, savePlan, shotsByRound } from '../db';
import { buildWeeklyPlan, diagnose } from '../domain/coach';
import { SG_LABEL, Profile } from '../domain/types';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';
import { useLoad } from '../useLoad';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Coach({ profile }: { profile: Profile }) {
  const { c } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { data, reload } = useLoad(getPlan);
  const [roundDay, setRoundDay] = useState(5);

  const regenerate = async () => {
    const [rounds, logs] = await Promise.all([shotsByRound(10), listDrillLogs()]);
    const diag = diagnose(rounds.map((r) => r.shots));
    const plan = buildWeeklyPlan(profile, diag, logs, { roundDay, seed: Math.floor(Date.now() / 6.048e8) });
    await savePlan(plan);
    reload();
  };

  return (
    <Screen>
      <H1>My Coach</H1>
      <Card>
        <H2>Which day do you plan to play?</H2>
        <ChipRow>
          {DAYS.map((d, i) => (
            <Chip key={d} label={d} selected={roundDay === i} onPress={() => setRoundDay(i)} />
          ))}
        </ChipRow>
        <Button label={data ? 'Rebuild plan from latest data' : 'Build my plan'} onPress={regenerate} />
      </Card>

      {data && (
        <>
          <Card>
            <H2>Why this plan</H2>
            {data.rationale.map((r, i) => (
              <Body key={i}>• {r}</Body>
            ))}
            <Body muted>Focus this week: {SG_LABEL[data.focus]}</Body>
          </Card>
          {data.sessions.map((s, i) => (
            <Pressable key={i} onPress={() => s.kind !== 'round' && nav.navigate('Session', { dayIndex: s.day })} accessibilityRole="button">
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '800', color: c.accent, width: 48 }}>{DAYS[s.day]}</Text>
                  <Text style={{ flex: 1, fontSize: 16, color: c.text }}>{s.title}</Text>
                  <Text style={{ color: c.muted }}>{s.minutes} min</Text>
                </Row>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
