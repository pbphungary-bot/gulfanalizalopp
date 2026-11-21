import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Row, Screen } from '../components/ui';
import { addShot, deleteLastShot, getRound, shotsForRound } from '../db';
import { expectedStrokes } from '../domain/strokesGained';
import type { Lie, Round, Shot } from '../domain/types';
import type { RootStackParams } from '../navigation';
import { colors } from '../theme';

const CLUBS = ['Driver', '3W', '5W', 'Hybrid', '4i', '5i', '6i', '7i', '8i', '9i', 'PW', 'GW', 'SW', 'LW', 'Putter'];
const END_LIES: Lie[] = ['fairway', 'rough', 'sand', 'recovery', 'green', 'holed'];

/**
 * One shot at a time, designed to be fast: start position carries over from the previous
 * shot, so you normally only pick a club, where it ended up, and a distance.
 */
export function RoundScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { params } = useRoute<RouteProp<RootStackParams, 'Round'>>();
  const [round, setRound] = useState<Round | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [hole, setHole] = useState(1);

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
  const curPar = holeStarted ? holeShots[0].par : par;

  const start = last
    ? { lie: last.endLie, dist: last.endDist }
    : { lie: 'tee' as Lie, dist: parseFloat(yardage) };
  const inputs = endLie === 'holed' ? 0 : parseFloat(endDist);
  const canSave = !Number.isNaN(start.dist) && start.dist > 0 && (endLie === 'holed' || (!Number.isNaN(inputs) && inputs >= 0));
  const total = shots.length + shots.reduce((a, s) => a + s.penalty, 0);

  const save = async () => {
    if (!round || !canSave) return;
    await addShot({
      roundId: round.id, hole, par: curPar, shotNo: holeShots.length + 1, club,
      startLie: start.lie, startDist: start.dist, endLie, endDist: endLie === 'holed' ? 0 : inputs, penalty,
    });
    const next = endLie === 'holed';
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
      Alert.alert('No shots recorded', 'Record at least one shot, or go back to discard this empty round.');
      return;
    }
    nav.replace('RoundReview', { roundId: round.id });
  };

  const unit = (lie: Lie) => (lie === 'green' ? 'feet' : 'yards');
  const sgPreview = canSave
    ? expectedStrokes(start.lie, start.dist) - expectedStrokes(endLie, endLie === 'holed' ? 0 : inputs) - 1 - penalty
    : null;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Hole {hole}</H1>
        <Text style={{ fontSize: 16, color: colors.muted }}>{round?.course} · {total} strokes</Text>
      </Row>

      {!holeStarted && (
        <Card>
          <H2>Hole setup</H2>
          <ChipRow>
            {([3, 4, 5] as const).map((p) => (
              <Chip key={p} label={`Par ${p}`} selected={par === p} onPress={() => setPar(p)} />
            ))}
          </ChipRow>
          <Field label="Hole length (yards)" value={yardage} onChangeText={setYardage} keyboardType="numeric" />
        </Card>
      )}

      <Card>
        <H2>
          Shot {holeShots.length + 1} · from {start.lie}
          {!Number.isNaN(start.dist) ? ` · ${Math.round(start.dist)} ${unit(start.lie)}` : ''}
        </H2>
        <Body muted>Club</Body>
        <ChipRow>
          {CLUBS.map((c) => (
            <Chip key={c} label={c} selected={club === c} onPress={() => setClub(c)} />
          ))}
        </ChipRow>
        <Body muted>Where did it finish?</Body>
        <ChipRow>
          {END_LIES.map((l) => (
            <Chip key={l} label={l} selected={endLie === l} onPress={() => setEndLie(l)} />
          ))}
        </ChipRow>
        {endLie !== 'holed' && (
          <Field label={`Distance to hole (${unit(endLie)})`} value={endDist} onChangeText={setEndDist} keyboardType="numeric" />
        )}
        <Body muted>Penalty strokes</Body>
        <ChipRow>
          {[0, 1, 2].map((n) => (
            <Chip key={n} label={String(n)} selected={penalty === n} onPress={() => setPenalty(n)} />
          ))}
        </ChipRow>
        {sgPreview !== null && (
          <Body muted>Strokes gained on this shot: {sgPreview > 0 ? '+' : ''}{sgPreview.toFixed(2)}</Body>
        )}
        <Button label={endLie === 'holed' ? 'Holed — next hole' : 'Save shot'} onPress={save} disabled={!canSave} />
      </Card>

      <Row>
        <Button label="Undo last" variant="secondary" onPress={undo} disabled={shots.length === 0} />
        <Button label="Finish round" onPress={finish} />
      </Row>
    </Screen>
  );
}
