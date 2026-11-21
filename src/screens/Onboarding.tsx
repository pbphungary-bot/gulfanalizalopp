import React, { useState } from 'react';
import { Alert, Switch, Text } from 'react-native';
import { Body, Button, Card, Field, H1, H2, Row, Screen } from '../components/ui';
import { saveProfile } from '../db';
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
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [hcp, setHcp] = useState(String(DEFAULT_PROFILE.handicap));
  const [target, setTarget] = useState(String(DEFAULT_PROFILE.targetHandicap));
  const [days, setDays] = useState(String(DEFAULT_PROFILE.practiceDaysPerWeek));
  const [mins, setMins] = useState(String(DEFAULT_PROFILE.practiceMinutesPerWeek));
  const [gymDays, setGymDays] = useState(String(DEFAULT_PROFILE.gymDaysPerWeek));

  const submit = async () => {
    const h = parseFloat(hcp);
    const t = parseFloat(target);
    const d = parseInt(days, 10);
    const m = parseInt(mins, 10);
    const g = parseInt(gymDays, 10);
    if ([h, t, d, m, g].some((n) => Number.isNaN(n)) || d < 1 || d > 6 || g < 0 || g > 5 || m < 30) {
      Alert.alert('Check your answers', 'Practice days 1–6, gym days 0–5, and at least 30 practice minutes per week.');
      return;
    }
    const profile: Profile = { ...p, handicap: h, targetHandicap: t, practiceDaysPerWeek: d, practiceMinutesPerWeek: m, gymDaysPerWeek: g };
    await saveProfile(profile);
    onDone(profile);
  };

  return (
    <Screen>
      <H1>Welcome to your golf coach</H1>
      <Body muted>A few answers so your plan fits your life. You can change these later.</Body>
      <Card>
        <H2>You</H2>
        <Field label="Name" value={p.name} onChangeText={(name) => setP({ ...p, name })} />
        <Field label="Current handicap" value={hcp} onChangeText={setHcp} keyboardType="decimal-pad" />
        <Field label="Target handicap" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      </Card>
      <Card>
        <H2>Time</H2>
        <Field label="Practice days per week" value={days} onChangeText={setDays} keyboardType="numeric" />
        <Field label="Practice minutes per week" value={mins} onChangeText={setMins} keyboardType="numeric" />
        <Field label="Gym days per week" value={gymDays} onChangeText={setGymDays} keyboardType="numeric" />
      </Card>
      <Card>
        <H2>What you have access to</H2>
        <Toggle label="Driving range" value={p.hasRange} onChange={(hasRange) => setP({ ...p, hasRange })} />
        <Toggle label="Putting green" value={p.hasPuttingGreen} onChange={(hasPuttingGreen) => setP({ ...p, hasPuttingGreen })} />
        <Toggle label="Short-game area" value={p.hasShortGameArea} onChange={(hasShortGameArea) => setP({ ...p, hasShortGameArea })} />
        <Toggle label="Gym" value={p.hasGym} onChange={(hasGym) => setP({ ...p, hasGym })} />
        <Toggle label="Launch monitor" value={p.usesLaunchMonitor} onChange={(usesLaunchMonitor) => setP({ ...p, usesLaunchMonitor })} />
      </Card>
      <Button label="Build my plan" onPress={submit} />
    </Screen>
  );
}
