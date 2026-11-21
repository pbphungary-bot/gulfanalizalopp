import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Body, Button, Card, H1, H2, Screen, SgValue, Row } from '../components/ui';
import { getPlan, shotsByRound } from '../db';
import { diagnose } from '../domain/coach';
import { SG_LABEL, SgCategory } from '../domain/types';
import type { RootStackParams } from '../navigation';
import { useLoad } from '../useLoad';
import { colors } from '../theme';
import { Text } from 'react-native';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const todayIndex = () => (new Date().getDay() + 6) % 7;

export function Home({ name }: { name: string }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { data } = useLoad(async () => {
    const [plan, rounds] = await Promise.all([getPlan(), shotsByRound(10)]);
    return { plan, diag: diagnose(rounds.map((r) => r.shots)) };
  });
  const today = todayIndex();
  const plan = data?.plan;
  const diag = data?.diag;
  const todays = plan?.sessions.filter((s) => s.day === today) ?? [];
  const next = plan?.sessions.filter((s) => s.day > today).slice(0, 3) ?? [];

  return (
    <Screen>
      <H1>{name ? `Hi ${name}` : 'Hi'}</H1>
      {diag && (
        <Card>
          <H2>Your game</H2>
          {diag.roundsAnalyzed > 0 && (
            <Row style={{ flexWrap: 'wrap' }}>
              {(['tee', 'approach', 'short', 'putting'] as SgCategory[]).map((c) => (
                <Row key={c} style={{ gap: 6 }}>
                  <Text style={{ color: colors.muted }}>{SG_LABEL[c]}</Text>
                  <SgValue value={diag.avgPerRound[c]} size={15} />
                </Row>
              ))}
            </Row>
          )}
          {diag.messages.map((m, i) => (
            <Body key={i}>{m}</Body>
          ))}
        </Card>
      )}
      <Card>
        <H2>Today ({DAYS[today]})</H2>
        {!plan && <Body muted>Open the Coach tab to generate your weekly plan.</Body>}
        {plan && todays.length === 0 && <Body muted>Nothing scheduled. Rest is part of the plan.</Body>}
        {todays.map((s, i) => (
          <Button
            key={i}
            label={`${s.title} · ${s.minutes} min`}
            onPress={() => (s.kind === 'round' ? nav.navigate('Tabs') : nav.navigate('Session', { dayIndex: s.day }))}
          />
        ))}
      </Card>
      {next.length > 0 && (
        <Card>
          <H2>Coming up</H2>
          {next.map((s, i) => (
            <Body key={i}>
              {DAYS[s.day]}: {s.title}
            </Body>
          ))}
        </Card>
      )}
    </Screen>
  );
}
