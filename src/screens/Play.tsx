import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Row, Screen } from '../components/ui';
import { createRound, listRounds, shotsForRound } from '../db';
import { roundScore } from '../domain/strokesGained';
import type { Round } from '../domain/types';
import type { RootStackParams } from '../navigation';
import { colors } from '../theme';
import { useLoad } from '../useLoad';

export function Play() {
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
      course: course.trim() || 'Unnamed course',
      playedAt: new Date().toISOString(),
      holes,
      parTotal: 0,
      kind,
    });
    nav.navigate('Round', { roundId: id });
  };

  return (
    <Screen>
      <H1>Play golf</H1>
      <Card>
        <H2>New round</H2>
        <Field label="Course" value={course} onChangeText={setCourse} placeholder="Course name" />
        <ChipRow>
          <Chip label="18 holes" selected={holes === 18} onPress={() => setHoles(18)} />
          <Chip label="9 holes" selected={holes === 9} onPress={() => setHoles(9)} />
          <Chip label="Practice" selected={kind === 'practice'} onPress={() => setKind('practice')} />
          <Chip label="Competition" selected={kind === 'competition'} onPress={() => setKind('competition')} />
        </ChipRow>
        <Button label="Start round" onPress={start} />
      </Card>
      {rounds && rounds.length > 0 && <H2>Past rounds</H2>}
      {rounds?.map(({ r, score }) => (
        <Pressable key={r.id} onPress={() => nav.navigate('RoundReview', { roundId: r.id })} accessibilityRole="button">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700' }}>{r.course}</Body>
              <Text style={{ fontWeight: '800', fontSize: 20, color: colors.primary }}>{score || '–'}</Text>
            </Row>
            <Body muted>{new Date(r.playedAt).toLocaleDateString()} · {r.holes} holes · {r.kind}</Body>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
