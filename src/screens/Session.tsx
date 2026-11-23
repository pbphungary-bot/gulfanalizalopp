import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Body, Button, Card, H1, H2, Screen } from '../components/ui';
import { getPlan } from '../db';
import { sessionTitle } from '../domain/coach';
import { DRILL_BY_ID, drillText } from '../domain/drills';
import { GYM_TEMPLATES, prescription } from '../domain/gym';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { useLoad } from '../useLoad';

export function Session() {
  const { t, system } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { params } = useRoute<RouteProp<RootStackParams, 'Session'>>();
  const { data: plan } = useLoad(getPlan);
  const sessions = plan?.sessions.filter((s) => s.day === params.dayIndex) ?? [];
  const mobility = GYM_TEMPLATES.mobility.exercises;

  return (
    <Screen>
      {sessions.map((s, i) => (
        <Card key={i}>
          <H1>{sessionTitle(s, t)}</H1>
          <Body muted>{t('common.minutes', { n: s.minutes })}</Body>
          {s.kind === 'practice' &&
            s.drillIds?.map((id) => {
              const d = DRILL_BY_ID[id];
              if (!d) return null;
              const text = drillText(d, t, system);
              return (
                <Card key={id}>
                  <H2>{text.name} · {t('common.min', { n: d.minutes })}</H2>
                  <Body>{text.goal}</Body>
                  {text.steps.map((st, k) => (
                    <Body key={k}>{k + 1}. {st}</Body>
                  ))}
                  <Button label={t('session.logResults')} variant="secondary" onPress={() => nav.navigate('Drill', { drillId: id })} />
                </Card>
              );
            })}
          {s.kind === 'gym' && s.gymTemplate && (
            <>
              <Body>{t(`gym.tpl.${s.gymTemplate}.note`)}</Body>
              {GYM_TEMPLATES[s.gymTemplate].exercises.map((e) => (
                <Body key={e.id}>• {t(`gym.ex.${e.id}`)} — {prescription(e, t)}</Body>
              ))}
              <Body muted>{t('gym.safety')}</Body>
            </>
          )}
          {s.kind === 'recovery' &&
            mobility.map((e) => (
              <Body key={e.id}>• {t(`gym.ex.${e.id}`)} — {prescription(e, t)}</Body>
            ))}
        </Card>
      ))}
    </Screen>
  );
}
