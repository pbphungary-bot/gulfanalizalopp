import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Screen } from '../components/ui';
import { addDrillLog } from '../db';
import { DRILL_BY_ID } from '../domain/drills';
import type { DrillLog } from '../domain/types';
import type { RootStackParams } from '../navigation';

export function DrillScreen() {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParams, 'Drill'>>();
  const drill = DRILL_BY_ID[params.drillId];
  const [attempts, setAttempts] = useState('10');
  const [successes, setSuccesses] = useState('');
  const [feeling, setFeeling] = useState<DrillLog['feeling']>(3);
  const [note, setNote] = useState('');

  if (!drill) return null;

  const save = async () => {
    const a = parseInt(attempts, 10);
    const s = parseInt(successes, 10);
    if (Number.isNaN(a) || Number.isNaN(s) || a < 1 || s < 0 || s > a) {
      Alert.alert('Check the numbers', 'Successes must be between 0 and the number of attempts.');
      return;
    }
    await addDrillLog({ drillId: drill.id, category: drill.category, loggedAt: new Date().toISOString(), attempts: a, successes: s, feeling, note });
    nav.goBack();
  };

  return (
    <Screen>
      <H1>{drill.name}</H1>
      <Card>
        <H2>Success means</H2>
        <Body>{drill.successRule}</Body>
      </Card>
      <Field label="Balls / attempts" value={attempts} onChangeText={setAttempts} keyboardType="numeric" />
      <Field label="Successes" value={successes} onChangeText={setSuccesses} keyboardType="numeric" />
      <Body muted>How did it feel? (1 = struggled, 5 = great)</Body>
      <ChipRow>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <Chip key={n} label={String(n)} selected={feeling === n} onPress={() => setFeeling(n)} />
        ))}
      </ChipRow>
      <Field label="Notes (optional)" value={note} onChangeText={setNote} />
      <Button label="Save" onPress={save} />
    </Screen>
  );
}
