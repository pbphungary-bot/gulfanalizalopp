import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Body, Button, Card, H1, H2, Screen } from '../components/ui';
import { getPlan } from '../db';
import { DRILL_BY_ID } from '../domain/drills';
import { GYM_SAFETY_NOTE, GYM_TEMPLATES } from '../domain/gym';
import type { RootStackParams } from '../navigation';
import { useLoad } from '../useLoad';

export function Session() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { params } = useRoute<RouteProp<RootStackParams, 'Session'>>();
  const { data: plan } = useLoad(getPlan);
  const sessions = plan?.sessions.filter((s) => s.day === params.dayIndex) ?? [];

  return (
    <Screen>
      {sessions.map((s, i) => (
        <Card key={i}>
          <H1>{s.title}</H1>
          <Body muted>{s.minutes} minutes</Body>
          {s.kind === 'practice' &&
            s.drillIds?.map((id) => {
              const d = DRILL_BY_ID[id];
              if (!d) return null;
              return (
                <Card key={id}>
                  <H2>
                    {d.name} · {d.minutes} min
                  </H2>
                  <Body>{d.goal}</Body>
                  {d.steps.map((st, k) => (
                    <Body key={k}>{k + 1}. {st}</Body>
                  ))}
                  <Button label="Log results" variant="secondary" onPress={() => nav.navigate('Drill', { drillId: id })} />
                </Card>
              );
            })}
          {s.kind === 'gym' && s.gymTemplate && (
            <>
              <Body>{GYM_TEMPLATES[s.gymTemplate].note}</Body>
              {GYM_TEMPLATES[s.gymTemplate].exercises.map((e) => (
                <Body key={e.name}>• {e.name} — {e.prescription}</Body>
              ))}
              <Body muted>{GYM_SAFETY_NOTE}</Body>
            </>
          )}
          {s.kind === 'recovery' && (
            <>
              {GYM_TEMPLATES.mobility.exercises.map((e) => (
                <Body key={e.name}>• {e.name} — {e.prescription}</Body>
              ))}
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
