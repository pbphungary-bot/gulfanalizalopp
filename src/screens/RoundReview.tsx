import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, H1, H2, Row, Screen, SgValue } from '../components/ui';
import { deleteRound, getRound, shotsForRound } from '../db';
import { approachBands, roundScore, roundStrokesGained } from '../domain/strokesGained';
import type { SgCategory } from '../domain/types';
import { formatBand } from '../domain/units';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { useLoad } from '../useLoad';

export function RoundReview() {
  const { t, num, date, system } = useI18n();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParams, 'RoundReview'>>();
  const { data } = useLoad(async () => {
    const [round, shots] = await Promise.all([getRound(params.roundId), shotsForRound(params.roundId)]);
    return { round, shots };
  }, [params.roundId]);

  if (!data?.round) return null;
  const { round, shots } = data;
  const { totals } = roundStrokesGained(shots);
  const bands = approachBands(shots, system);
  const cats: SgCategory[] = ['tee', 'approach', 'short', 'putting'];
  const worst = cats.reduce((a, b) => (totals[a] <= totals[b] ? a : b));

  const remove = () =>
    Alert.alert(t('review.deleteTitle'), t('review.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteRound(round.id); nav.goBack(); } },
    ]);

  return (
    <Screen>
      <H1>{round.course}</H1>
      <Card>
        <H2>{t('review.score')}</H2>
        <Body style={{ fontSize: 40, fontWeight: '800' }}>{roundScore(shots)}</Body>
        <Body muted>{t('review.shotsDate', { n: shots.length, date: date(round.playedAt) })}</Body>
      </Card>
      <Card>
        <H2>{t('review.sg')}</H2>
        {cats.map((c) => (
          <Row key={c} style={{ justifyContent: 'space-between' }}>
            <Body>{t(`sg.${c}`)}</Body>
            <SgValue value={totals[c]} />
          </Row>
        ))}
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ fontWeight: '800' }}>{t('review.total')}</Body>
          <SgValue value={totals.total} />
        </Row>
        <Body muted>{t('review.placeholder')}</Body>
      </Card>
      <Card>
        <H2>{t('review.opp')}</H2>
        <Body>{t('review.oppBody', { cat: t(`sg.${worst}`), v: { n: totals[worst], d: 2 } })}</Body>
      </Card>
      {bands.length > 0 && (
        <Card>
          <H2>{t('review.approachBands')}</H2>
          {bands.map((b) => (
            <Row key={b.loM} style={{ justifyContent: 'space-between' }}>
              <Body>{formatBand(b, system)} ({num(b.shots)})</Body>
              <SgValue value={b.avgSg} size={16} />
            </Row>
          ))}
        </Card>
      )}
      <Button label={t('review.delete')} variant="danger" onPress={remove} />
    </Screen>
  );
}
