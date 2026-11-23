import React, { useState } from 'react';
import { Body, Card, Chip, ChipRow, H1, H2, Row, Screen, SgValue } from '../components/ui';
import { listDrillLogs, shotsByRound } from '../db';
import { diagnose, mastery } from '../domain/coach';
import type { SgCategory } from '../domain/types';
import { useI18n } from '../i18n';
import { useLoad } from '../useLoad';
import { ClubDistances } from './ClubDistances';

const CATS: SgCategory[] = ['tee', 'approach', 'short', 'putting'];

export function MyGame() {
  const { t, tm, system } = useI18n();
  const [view, setView] = useState<'overview' | 'clubs'>('overview');
  const { data } = useLoad(async () => {
    const [rounds, logs] = await Promise.all([shotsByRound(10), listDrillLogs()]);
    return { diag: diagnose(rounds.map((r) => r.shots), system), logs, count: rounds.length };
  });

  return (
    <Screen>
      <H1>{t('mg.title')}</H1>
      <ChipRow>
        <Chip label={t('mg.overview')} selected={view === 'overview'} onPress={() => setView('overview')} />
        <Chip label={t('mg.clubs')} selected={view === 'clubs'} onPress={() => setView('clubs')} />
      </ChipRow>

      {view === 'clubs' && <ClubDistances />}

      {view === 'overview' && data && (
        <>
          {data.diag.roundsAnalyzed > 0 && (
            <Card>
              <H2>{t('mg.working')}</H2>
              {CATS.filter((c) => data.diag.avgPerRound[c] > 0.05)
                .sort((a, b) => data.diag.avgPerRound[b] - data.diag.avgPerRound[a])
                .map((c) => (
                  <Row key={c} style={{ justifyContent: 'space-between' }}>
                    <Body>{t(`sg.${c}`)}</Body>
                    <SgValue value={data.diag.avgPerRound[c]} />
                  </Row>
                ))}
              {CATS.every((c) => data.diag.avgPerRound[c] <= 0.05) && <Body muted>{t('mg.nothingGaining')}</Body>}
              <Body muted style={{ fontSize: 12 }}>{t('mg.keep')}</Body>

              <H2>{t('mg.costing')}</H2>
              {CATS.filter((c) => data.diag.avgPerRound[c] < -0.05)
                .sort((a, b) => data.diag.avgPerRound[a] - data.diag.avgPerRound[b])
                .map((c) => (
                  <Row key={c} style={{ justifyContent: 'space-between' }}>
                    <Body>{t(`sg.${c}`)}</Body>
                    <SgValue value={data.diag.avgPerRound[c]} />
                  </Row>
                ))}
              {CATS.every((c) => data.diag.avgPerRound[c] >= -0.05) && <Body muted>{t('mg.nothingCosting')}</Body>}
              {data.diag.messages
                .filter((m) => m.k === 'diag.weakBand')
                .map((m, i) => (
                  <Body key={i} muted style={{ fontSize: 12 }}>{tm(m)}</Body>
                ))}
              {!data.diag.hasEnoughData && <Body muted style={{ fontSize: 12 }}>{t('mg.littleData')}</Body>}
            </Card>
          )}
          <Card>
            <H2>{t('mg.sgPer', { n: data.diag.roundsAnalyzed || 0 })}</H2>
            {data.diag.roundsAnalyzed === 0 && <Body muted>{t('mg.playToSee')}</Body>}
            {data.diag.roundsAnalyzed > 0 &&
              CATS.map((c) => (
                <Row key={c} style={{ justifyContent: 'space-between' }}>
                  <Body>{t(`sg.${c}`)}</Body>
                  <SgValue value={data.diag.avgPerRound[c]} />
                </Row>
              ))}
            {!data.diag.hasEnoughData && data.diag.roundsAnalyzed > 0 && <Body muted>{t('mg.littleData')}</Body>}
          </Card>
          <Card>
            <H2>{t('mg.drillSuccess')}</H2>
            {CATS.map((c) => {
              const m = mastery(data.logs, c);
              return (
                <Row key={c} style={{ justifyContent: 'space-between' }}>
                  <Body>{t(`sg.${c}`)}</Body>
                  <Body muted>{m === null ? t('mg.notEnough') : `${Math.round(m * 100)}%`}</Body>
                </Row>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}
