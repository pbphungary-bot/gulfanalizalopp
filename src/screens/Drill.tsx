import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Screen } from '../components/ui';
import { addDrillLog } from '../db';
import { DRILL_BY_ID, drillText } from '../domain/drills';
import type { DrillLog } from '../domain/types';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';

export function DrillScreen() {
  const { t, system } = useI18n();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParams, 'Drill'>>();
  const drill = DRILL_BY_ID[params.drillId];
  const [attempts, setAttempts] = useState('10');
  const [successes, setSuccesses] = useState('');
  const [feeling, setFeeling] = useState<DrillLog['feeling']>(3);
  const [note, setNote] = useState('');

  if (!drill) return null;
  const text = drillText(drill, t, system);

  const save = async () => {
    const a = parseInt(attempts, 10);
    const s = parseInt(successes, 10);
    if (Number.isNaN(a) || Number.isNaN(s) || a < 1 || s < 0 || s > a) {
      Alert.alert(t('drillLog.checkTitle'), t('drillLog.checkBody'));
      return;
    }
    await addDrillLog({ drillId: drill.id, category: drill.category, loggedAt: new Date().toISOString(), attempts: a, successes: s, feeling, note });
    nav.goBack();
  };

  return (
    <Screen>
      <H1>{text.name}</H1>
      <Card>
        <H2>{t('drillLog.success')}</H2>
        <Body>{text.rule}</Body>
      </Card>
      <Field label={t('drillLog.attempts')} value={attempts} onChangeText={setAttempts} keyboardType="numeric" />
      <Field label={t('drillLog.successes')} value={successes} onChangeText={setSuccesses} keyboardType="numeric" />
      <Body muted>{t('drillLog.feel')}</Body>
      <ChipRow>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <Chip key={n} label={String(n)} selected={feeling === n} onPress={() => setFeeling(n)} />
        ))}
      </ChipRow>
      <Field label={t('drillLog.notes')} value={note} onChangeText={setNote} />
      <Button label={t('drillLog.save')} onPress={save} />
    </Screen>
  );
}
