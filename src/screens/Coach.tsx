import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, H1, H2, Row, Screen } from '../components/ui';
import { getPlan, listDrillLogs, savePlan, shotsByRound } from '../db';
import { buildWeeklyPlan, diagnose, sessionTitle } from '../domain/coach';
import type { Profile } from '../domain/types';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';
import { useLoad } from '../useLoad';

export function Coach({ profile }: { profile: Profile }) {
  const { c } = useTheme();
  const { t, tm, system } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { data, reload } = useLoad(getPlan);
  const [roundDay, setRoundDay] = useState(5);

  const regenerate = async () => {
    const [rounds, logs] = await Promise.all([shotsByRound(10), listDrillLogs()]);
    const diag = diagnose(rounds.map((r) => r.shots), system);
    const plan = buildWeeklyPlan(profile, diag, logs, { roundDay, seed: Math.floor(Date.now() / 6.048e8) });
    await savePlan(plan);
    reload();
  };

  return (
    <Screen>
      <H1>{t('coach.title')}</H1>
      <Card>
        <H2>{t('coach.playDay')}</H2>
        <ChipRow>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Chip key={i} label={t(`dayName.${i}`)} selected={roundDay === i} onPress={() => setRoundDay(i)} />
          ))}
        </ChipRow>
        <Button label={data ? t('coach.rebuild') : t('coach.build')} onPress={regenerate} />
      </Card>

      {data && (
        <>
          <Card>
            <H2>{t('coach.why')}</H2>
            {data.rationale.map((r, i) => (
              <Body key={i}>• {tm(r)}</Body>
            ))}
            <Body muted>{t('coach.focus', { cat: t(`sg.${data.focus}`) })}</Body>
          </Card>
          {data.sessions.map((s, i) => (
            <Pressable key={i} onPress={() => s.kind !== 'round' && nav.navigate('Session', { dayIndex: s.day })} accessibilityRole="button">
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '800', color: c.accent, width: 48 }}>{t(`dayName.${s.day}`)}</Text>
                  <Text style={{ flex: 1, fontSize: 16, color: c.text }}>{sessionTitle(s, t)}</Text>
                  <Text style={{ color: c.muted }}>{t('common.min', { n: s.minutes })}</Text>
                </Row>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
