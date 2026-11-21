import React from 'react';
import { Body, Card, H1, H2, Row, Screen, SgValue } from '../components/ui';
import { listDrillLogs, shotsByRound } from '../db';
import { diagnose, mastery } from '../domain/coach';
import { SG_LABEL, SgCategory } from '../domain/types';
import { useLoad } from '../useLoad';

const CATS: SgCategory[] = ['tee', 'approach', 'short', 'putting'];

export function MyGame() {
  const { data } = useLoad(async () => {
    const [rounds, logs] = await Promise.all([shotsByRound(10), listDrillLogs()]);
    return { diag: diagnose(rounds.map((r) => r.shots)), logs, count: rounds.length };
  });
  if (!data) return null;
  const { diag, logs } = data;

  return (
    <Screen>
      <H1>My game</H1>
      <Card>
        <H2>Strokes gained per round (last {diag.roundsAnalyzed || 0})</H2>
        {diag.roundsAnalyzed === 0 && <Body muted>Play and track a round to see this.</Body>}
        {diag.roundsAnalyzed > 0 &&
          CATS.map((c) => (
            <Row key={c} style={{ justifyContent: 'space-between' }}>
              <Body>{SG_LABEL[c]}</Body>
              <SgValue value={diag.avgPerRound[c]} />
            </Row>
          ))}
        {!diag.hasEnoughData && diag.roundsAnalyzed > 0 && <Body muted>Based on very little data so far.</Body>}
      </Card>
      <Card>
        <H2>Drill success</H2>
        {CATS.map((c) => {
          const m = mastery(logs, c);
          return (
            <Row key={c} style={{ justifyContent: 'space-between' }}>
              <Body>{SG_LABEL[c]}</Body>
              <Body muted>{m === null ? 'not enough data' : `${Math.round(m * 100)}%`}</Body>
            </Row>
          );
        })}
      </Card>
    </Screen>
  );
}
