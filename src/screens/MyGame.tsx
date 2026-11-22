import React, { useState } from 'react';
import { Body, Card, Chip, ChipRow, H1, H2, Row, Screen, SgValue } from '../components/ui';
import { listDrillLogs, shotsByRound } from '../db';
import { diagnose, mastery } from '../domain/coach';
import { SG_LABEL, SgCategory } from '../domain/types';
import { useLoad } from '../useLoad';
import { ClubDistances } from './ClubDistances';

const CATS: SgCategory[] = ['tee', 'approach', 'short', 'putting'];

export function MyGame() {
  const [view, setView] = useState<'overview' | 'clubs'>('overview');
  const { data } = useLoad(async () => {
    const [rounds, logs] = await Promise.all([shotsByRound(10), listDrillLogs()]);
    return { diag: diagnose(rounds.map((r) => r.shots)), logs, count: rounds.length };
  });

  return (
    <Screen>
      <H1>My game</H1>
      <ChipRow>
        <Chip label="Overview" selected={view === 'overview'} onPress={() => setView('overview')} />
        <Chip label="Club distances" selected={view === 'clubs'} onPress={() => setView('clubs')} />
      </ChipRow>

      {view === 'clubs' && <ClubDistances />}

      {view === 'overview' && data && (
        <>
          <Card>
            <H2>Strokes gained per round (last {data.diag.roundsAnalyzed || 0})</H2>
            {data.diag.roundsAnalyzed === 0 && <Body muted>Play and track a round to see this.</Body>}
            {data.diag.roundsAnalyzed > 0 &&
              CATS.map((c) => (
                <Row key={c} style={{ justifyContent: 'space-between' }}>
                  <Body>{SG_LABEL[c]}</Body>
                  <SgValue value={data.diag.avgPerRound[c]} />
                </Row>
              ))}
            {!data.diag.hasEnoughData && data.diag.roundsAnalyzed > 0 && <Body muted>Based on very little data so far.</Body>}
          </Card>
          <Card>
            <H2>Drill success</H2>
            {CATS.map((c) => {
              const m = mastery(data.logs, c);
              return (
                <Row key={c} style={{ justifyContent: 'space-between' }}>
                  <Body>{SG_LABEL[c]}</Body>
                  <Body muted>{m === null ? 'not enough data' : `${Math.round(m * 100)}%`}</Body>
                </Row>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}
