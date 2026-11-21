import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, H1, H2, Row, Screen, SgValue } from '../components/ui';
import { deleteRound, getRound, shotsForRound } from '../db';
import { approachBands, roundScore, roundStrokesGained } from '../domain/strokesGained';
import { SG_LABEL, SgCategory } from '../domain/types';
import type { RootStackParams } from '../navigation';
import { useLoad } from '../useLoad';

export function RoundReview() {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParams, 'RoundReview'>>();
  const { data } = useLoad(async () => {
    const [round, shots] = await Promise.all([getRound(params.roundId), shotsForRound(params.roundId)]);
    return { round, shots };
  }, [params.roundId]);

  if (!data?.round) return null;
  const { round, shots } = data;
  const { totals } = roundStrokesGained(shots);
  const bands = approachBands(shots);
  const cats: SgCategory[] = ['tee', 'approach', 'short', 'putting'];
  const worst = cats.reduce((a, b) => (totals[a] <= totals[b] ? a : b));

  const remove = () =>
    Alert.alert('Delete this round?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRound(round.id); nav.goBack(); } },
    ]);

  return (
    <Screen>
      <H1>{round.course}</H1>
      <Card>
        <H2>Score</H2>
        <Body style={{ fontSize: 40, fontWeight: '800' }}>{roundScore(shots)}</Body>
        <Body muted>{shots.length} shots · {new Date(round.playedAt).toLocaleDateString()}</Body>
      </Card>
      <Card>
        <H2>Strokes gained</H2>
        {cats.map((c) => (
          <Row key={c} style={{ justifyContent: 'space-between' }}>
            <Body>{SG_LABEL[c]}</Body>
            <SgValue value={totals[c]} />
          </Row>
        ))}
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ fontWeight: '800' }}>Total</Body>
          <SgValue value={totals.total} />
        </Row>
        <Body muted>Compared with a placeholder baseline. See the README before treating these as official benchmarks.</Body>
      </Card>
      <Card>
        <H2>Your biggest opportunity</H2>
        <Body>{SG_LABEL[worst]} lost the most strokes this round ({totals[worst].toFixed(2)}). The Coach tab will weight your next plan toward it.</Body>
      </Card>
      {bands.length > 0 && (
        <Card>
          <H2>Approach by distance</H2>
          {bands.map((b) => (
            <Row key={b.label} style={{ justifyContent: 'space-between' }}>
              <Body>{b.label} ({b.shots})</Body>
              <SgValue value={b.avgSg} size={16} />
            </Row>
          ))}
        </Card>
      )}
      <Button label="Delete round" variant="danger" onPress={remove} />
    </Screen>
  );
}
