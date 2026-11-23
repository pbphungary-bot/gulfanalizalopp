import React, { useState } from 'react';
import { Alert, Switch, Text } from 'react-native';
import { Body, Button, Card, Field, H1, H2, Row, Screen } from '../components/ui';
import { LanguageToggle } from '../components/LanguageToggle';
import { UnitsToggle } from '../components/UnitsToggle';
import { saveProfile } from '../db';
import { useI18n } from '../i18n';
import { DEFAULT_PROFILE, Profile } from '../domain/types';

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', minHeight: 48 }}>
      <Text style={{ fontSize: 16, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </Row>
  );
}

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const { t } = useI18n();
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [hcp, setHcp] = useState(String(DEFAULT_PROFILE.handicap));
  const [target, setTarget] = useState(String(DEFAULT_PROFILE.targetHandicap));
  const [days, setDays] = useState(String(DEFAULT_PROFILE.practiceDaysPerWeek));
  const [mins, setMins] = useState(String(DEFAULT_PROFILE.practiceMinutesPerWeek));
  const [gymDays, setGymDays] = useState(String(DEFAULT_PROFILE.gymDaysPerWeek));

  const submit = async () => {
    const h = parseFloat(hcp.replace(',', '.'));
    const tg = parseFloat(target.replace(',', '.'));
    const d = parseInt(days, 10);
    const m = parseInt(mins, 10);
    const g = parseInt(gymDays, 10);
    if ([h, tg, d, m, g].some((n) => Number.isNaN(n)) || d < 1 || d > 6 || g < 0 || g > 5 || m < 30) {
      Alert.alert(t('onb.checkTitle'), t('onb.checkBody'));
      return;
    }
    const profile: Profile = { ...p, handicap: h, targetHandicap: tg, practiceDaysPerWeek: d, practiceMinutesPerWeek: m, gymDaysPerWeek: g };
    await saveProfile(profile);
    onDone(profile);
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <H1>{t('onb.title')}</H1>
        <UnitsToggle />
        <LanguageToggle />
      </Row>
      <Body muted>{t('onb.intro')}</Body>
      <Card>
        <H2>{t('onb.you')}</H2>
        <Field label={t('onb.name')} value={p.name} onChangeText={(name) => setP({ ...p, name })} />
        <Field label={t('onb.handicap')} value={hcp} onChangeText={setHcp} keyboardType="decimal-pad" />
        <Field label={t('onb.target')} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      </Card>
      <Card>
        <H2>{t('onb.time')}</H2>
        <Field label={t('onb.practiceDays')} value={days} onChangeText={setDays} keyboardType="numeric" />
        <Field label={t('onb.practiceMinutes')} value={mins} onChangeText={setMins} keyboardType="numeric" />
        <Field label={t('onb.gymDays')} value={gymDays} onChangeText={setGymDays} keyboardType="numeric" />
      </Card>
      <Card>
        <H2>{t('onb.access')}</H2>
        <Toggle label={t('onb.range')} value={p.hasRange} onChange={(hasRange) => setP({ ...p, hasRange })} />
        <Toggle label={t('onb.putting')} value={p.hasPuttingGreen} onChange={(hasPuttingGreen) => setP({ ...p, hasPuttingGreen })} />
        <Toggle label={t('onb.short')} value={p.hasShortGameArea} onChange={(hasShortGameArea) => setP({ ...p, hasShortGameArea })} />
        <Toggle label={t('onb.gym')} value={p.hasGym} onChange={(hasGym) => setP({ ...p, hasGym })} />
        <Toggle label={t('onb.monitor')} value={p.usesLaunchMonitor} onChange={(usesLaunchMonitor) => setP({ ...p, usesLaunchMonitor })} />
      </Card>
      <Button label={t('onb.build')} onPress={submit} />
    </Screen>
  );
}
