import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Row, Screen } from '../components/ui';
import { addShot, deleteLastShot, getRound, shotsForRound } from '../db';
import { getCourse, getRoundPlan } from '../db/courses';
import type { Course, Tee } from '../domain/courses';
import { expectedStrokes } from '../domain/strokesGained';
import type { Lie, Round, Shot } from '../domain/types';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';

const CLUBS = ['Driver', '3W', '5W', 'Hybrid', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW', 'Putter'];
const END_LIES: Lie[] = ['fairway', 'rough', 'sand', 'recovery', 'green'];

/**
 * One shot at a time, designed to be fast: start position carries over from the previous
 * shot, so you normally only pick a club, where it ended up, and a distance.
 */
export function RoundScreen() {
  const { c } = useTheme();
  const { t, num, len, short, unitLong, unitShort, parseLen, parseShort } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { params } = useRoute<RouteProp<RootStackParams, 'Round'>>();
  const [round, setRound] = useState<Round | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [hole, setHole] = useState(1);
  const [plan, setPlan] = useState<{ course: Course; tee: Tee } | null>(null);

  const [par, setPar] = useState<3 | 4 | 5>(4);
  const [yardage, setYardage] = useState('');
  const [club, setClub] = useState('Driver');
  const [endLie, setEndLie] = useState<Lie>('fairway');
  const [endDist, setEndDist] = useState('');
  const [penalty, setPenalty] = useState(0);

  const refresh = useCallback(async () => {
    const [r, s] = await Promise.all([getRound(params.roundId), shotsForRound(params.roundId)]);
    setRound(r);
    setShots(s);
    return { r, s };
  }, [params.roundId]);

  useEffect(() => {
    getRoundPlan(params.roundId)
      .then(async (p) => {
        const course = p ? await getCourse(p.courseId) : null;
        const tee = course?.tees.find((x) => x.id === p?.teeId);
        if (course && tee) setPlan({ course, tee });
      })
      .catch(() => {});
  }, [params.roundId]);

  useEffect(() => {
    refresh().then(({ s }) => {
      if (s.length) {
        const last = s[s.length - 1];
        const lastHoleDone = last.endLie === 'holed';
        setHole(lastHoleDone ? last.hole + 1 : last.hole);
      }
    });
  }, [refresh]);

  const holeShots = shots.filter((s) => s.hole === hole);
  const last = holeShots[holeShots.length - 1];
  const holeStarted = holeShots.length > 0;
  const planned = plan && hole <= plan.course.holes.length
    ? { par: plan.course.holes[hole - 1].par, si: plan.course.holes[hole - 1].si, length: plan.tee.lengths[hole - 1] }
    : null;
  const curPar = holeStarted ? holeShots[0].par : planned ? planned.par : par;

  const start = last
    ? { lie: last.endLie, dist: last.endDist }
    : { lie: 'tee' as Lie, dist: planned ? planned.length : parseLen(yardage) };
  const inputs = endLie === 'holed' ? 0 : endLie === 'green' ? parseShort(endDist) : parseLen(endDist);
  // A putt may start at 0 (ball on the lip) and still be holed.
  const startOk = !Number.isNaN(start.dist) && (endLie === 'holed' ? start.dist >= 0 : start.dist > 0);
  const canSave = startOk && (endLie === 'holed' || (!Number.isNaN(inputs) && inputs >= 0));
  const total = shots.length + shots.reduce((a, s) => a + s.penalty, 0);

  /** Can the ball be marked as holed from where it lies now? */
  const canHole = !Number.isNaN(start.dist) && start.dist >= 0;

  const save = async (holeOut = false) => {
    const lie: Lie = holeOut ? 'holed' : endLie;
    if (!round || (holeOut ? !canHole : !canSave)) return;
    await addShot({
      roundId: round.id, hole, par: curPar, shotNo: holeShots.length + 1, club: holeOut && start.lie === 'green' ? 'Putter' : club,
      startLie: start.lie, startDist: start.dist, endLie: lie, endDist: lie === 'holed' ? 0 : inputs, penalty,
    });
    const next = lie === 'holed';
    setEndDist('');
    setPenalty(0);
    if (next) {
      setYardage('');
      setHole(hole + 1);
      setClub('Driver');
      setEndLie('fairway');
    } else {
      setClub(endLie === 'green' ? 'Putter' : club);
    }
    await refresh();
  };

  const undo = async () => {
    await deleteLastShot(params.roundId);
    const { s } = await refresh();
    if (s.length) {
      const l = s[s.length - 1];
      setHole(l.endLie === 'holed' ? l.hole + 1 : l.hole);
    } else {
      setHole(1);
    }
  };

  const finish = () => {
    if (!round) return;
    if (shots.length === 0) {
      Alert.alert(t('round.noShotsTitle'), t('round.noShotsBody'));
      return;
    }
    nav.replace('RoundReview', { roundId: round.id });
  };

  const unit = (lie: Lie) => (lie === 'green' ? unitShort : unitLong);
  const sgPreview = canSave
    ? expectedStrokes(start.lie, start.dist) - expectedStrokes(endLie, endLie === 'holed' ? 0 : inputs) - 1 - penalty
    : null;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>{t('round.hole', { n: hole })}</H1>
        <Text style={{ fontSize: 16, color: c.muted }}>{t('round.header', { course: round?.course ?? '', n: total })}</Text>
      </Row>

      {planned && (
        <Body muted>{t('course.holeInfo', { par: planned.par, si: planned.si, len: len(planned.length) })}</Body>
      )}

      {!holeStarted && !planned && (
        <Card>
          <H2>{t('round.setup')}</H2>
          <ChipRow>
            {([3, 4, 5] as const).map((p) => (
              <Chip key={p} label={t('round.par', { n: p })} selected={par === p} onPress={() => setPar(p)} />
            ))}
          </ChipRow>
          <Field label={t('round.length', { unit: unitLong })} value={yardage} onChangeText={setYardage} keyboardType="decimal-pad" />
        </Card>
      )}

      <Card>
        <H2>
          {Number.isNaN(start.dist)
            ? t('round.shotFrom', { n: holeShots.length + 1, lie: t(`lie.${start.lie}`) })
            : t('round.shotFromDist', { n: holeShots.length + 1, lie: t(`lie.${start.lie}`), dist: start.lie === 'green' ? short(start.dist) : len(start.dist) })}
        </H2>
        <Body muted>{t('round.club')}</Body>
        <ChipRow>
          {CLUBS.map((cl) => (
            <Chip key={cl} label={cl} selected={club === cl} onPress={() => setClub(cl)} />
          ))}
        </ChipRow>
        <Body muted>{t('round.finish')}</Body>
        <ChipRow>
          {END_LIES.map((l) => (
            <Chip key={l} label={t(`lie.${l}`)} selected={endLie === l} onPress={() => setEndLie(l)} />
          ))}
        </ChipRow>
        {endLie !== 'holed' && (
          <Field label={t('round.dist', { unit: unit(endLie) })} value={endDist} onChangeText={setEndDist} keyboardType="decimal-pad" />
        )}
        <Body muted>{t('round.penalty')}</Body>
        <ChipRow>
          {[0, 1, 2].map((n) => (
            <Chip key={n} label={String(n)} selected={penalty === n} onPress={() => setPenalty(n)} />
          ))}
        </ChipRow>
        {sgPreview !== null && (
          <Body muted>{t('round.sgPreview', { v: `${sgPreview > 0 ? '+' : ''}${num(sgPreview, 2)}` })}</Body>
        )}
        <Button label={t('round.saveShot')} onPress={() => save()} disabled={!canSave} />
      </Card>

      <Card>
        <H2>{t('round.holeOutTitle')}</H2>
        <Body muted>{t('round.holeOutHint')}</Body>
        <Button label={t('round.nextHole')} onPress={() => save(true)} disabled={!canHole} />
      </Card>

      <Row>
        <Button label={t('round.prevHole')} variant="secondary" onPress={() => setHole(hole - 1)} disabled={hole <= 1} flex />
        <Button label={t('round.undo')} variant="secondary" onPress={undo} disabled={shots.length === 0} flex />
      </Row>
      <Button label={t('round.finishRound')} onPress={finish} />
    </Screen>
  );
}
