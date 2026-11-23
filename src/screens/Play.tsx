import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Row, Screen } from '../components/ui';
import { createRound, listRounds, shotsForRound } from '../db';
import { roundScore } from '../domain/strokesGained';
import type { Round } from '../domain/types';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';
import { useLoad } from '../useLoad';

export function Play() {
  const { c } = useTheme();
  const { t, date } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [course, setCourse] = useState('');
  const [holes, setHoles] = useState<9 | 18>(18);
  const [kind, setKind] = useState<Round['kind']>('practice');
  const { data: rounds } = useLoad(async () => {
    const rs = await listRounds();
    return Promise.all(rs.map(async (r) => ({ r, score: roundScore(await shotsForRound(r.id)) })));
  });

  const start = async () => {
    const id = await createRound({
      course: course.trim() || t('play.unnamed'),
      playedAt: new Date().toISOString(),
      holes,
      parTotal: 0,
      kind,
    });
    nav.navigate('Round', { roundId: id });
  };

  return (
    <Screen>
      <H1>{t('play.title')}</H1>
      <Card>
        <H2>{t('play.new')}</H2>
        <Field label={t('play.course')} value={course} onChangeText={setCourse} placeholder={t('play.coursePh')} />
        <ChipRow>
          <Chip label={t('play.h18')} selected={holes === 18} onPress={() => setHoles(18)} />
          <Chip label={t('play.h9')} selected={holes === 9} onPress={() => setHoles(9)} />
          <Chip label={t('play.kind.practice')} selected={kind === 'practice'} onPress={() => setKind('practice')} />
          <Chip label={t('play.kind.competition')} selected={kind === 'competition'} onPress={() => setKind('competition')} />
        </ChipRow>
        <Button label={t('play.start')} onPress={start} />
      </Card>
      {rounds && rounds.length > 0 && <H2>{t('play.past')}</H2>}
      {rounds?.map(({ r, score }) => (
        <Pressable key={r.id} onPress={() => nav.navigate('RoundReview', { roundId: r.id })} accessibilityRole="button">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700' }}>{r.course}</Body>
              <Text style={{ fontWeight: '800', fontSize: 20, color: c.accent }}>{score || '–'}</Text>
            </Row>
            <Body muted>{t('play.meta', { date: date(r.playedAt), holes: r.holes, kind: t(`play.kind.${r.kind}`) })}</Body>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
