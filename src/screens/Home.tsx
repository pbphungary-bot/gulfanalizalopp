import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LanguageToggle } from '../components/LanguageToggle';
import { Body, Button, Card, Eyebrow, H1, Row, Screen, StatCard } from '../components/ui';
import { getPlan, listDrillLogs, shotsByRound } from '../db';
import { diagnose, sessionTitle } from '../domain/coach';
import { averageScore, averageStrokesGained, practiceMinutesThisWeek } from '../domain/stats';
import type { PlannedSession, Profile } from '../domain/types';
import { useI18n } from '../i18n';
import type { RootStackParams, TabParams } from '../navigation';
import { space, useTheme } from '../theme';
import { useLoad } from '../useLoad';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<TabParams, 'Home'>, NativeStackNavigationProp<RootStackParams>>;

const todayIndex = () => (new Date().getDay() + 6) % 7;
const KIND_GLYPH: Record<PlannedSession['kind'], string> = { practice: '◎', gym: '⚡', round: '⛳', recovery: '○' };

export function Home({ profile }: { profile: Profile }) {
  const { c, isDark, setMode } = useTheme();
  const { t, tm, tn, num, minutes } = useI18n();
  const nav = useNavigation<Nav>();
  const { data } = useLoad(async () => {
    const [plan, rounds, logs] = await Promise.all([getPlan(), shotsByRound(10), listDrillLogs()]);
    return {
      plan,
      logs,
      diag: diagnose(rounds.map((r) => r.shots)),
      score: averageScore(rounds),
      sg: averageStrokesGained(rounds.slice(0, 5)),
    };
  });
  const today = todayIndex();
  const plan = data?.plan;
  const diag = data?.diag;
  const todays = plan?.sessions.filter((s) => s.day === today) ?? [];
  const practiceToday = todays.find((s) => s.kind === 'practice' || s.kind === 'gym');

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'greet.morning' : hour < 18 ? 'greet.afternoon' : 'greet.evening');

  // Coach message: built only from the player's own data.
  const coachText = !diag ? '' : (diag.messages.length ? diag.messages.slice(0, 2) : [{ k: 'diag.none' }]).map((m) => tm(m)).join(' ');

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Eyebrow accent>{greeting}{profile.name ? `, ${profile.name}` : ''}</Eyebrow>
          <H1>{t('home.title')}</H1>
          <Body muted>{t('home.journey', { target: profile.targetHandicap })}</Body>
        </View>
        <LanguageToggle />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? t('theme.toLight') : t('theme.toDark')}
          onPress={() => setMode(isDark ? 'light' : 'dark')}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 22, color: c.text }}>{isDark ? '☀' : '☾'}</Text>
        </Pressable>
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <StatCard label={t('home.handicap')} value={num(profile.handicap)} note={t('home.target', { n: profile.targetHandicap })} />
        <StatCard
          label={t('home.avgScore')}
          value={data?.score ? num(data.score.avg, 1) : '–'}
          note={data?.score ? tn('home.completeRounds', data.score.n) : t('home.noComplete')}
        />
        <StatCard
          label={t('home.sg')}
          value={data?.sg ? `${data.sg.avg > 0 ? '+' : ''}${num(data.sg.avg, 1)}` : '–'}
          note={data?.sg ? t('home.perRoundLast', { n: data.sg.n }) : t('home.trackToSee')}
        />
        <StatCard label={t('home.practice')} value={minutes(data ? practiceMinutesThisWeek(data.logs) : 0)} note={t('home.loggedWeek')} />
      </View>

      <Card style={{ borderColor: c.accent, backgroundColor: c.cardAlt }}>
        <Eyebrow accent>{t('home.coach')}</Eyebrow>
        <Body style={{ fontSize: 18, lineHeight: 26 }}>{coachText}</Body>
        {plan && <Body muted>{t('home.priority', { cat: t(`sg.${plan.focus}`) })}</Body>}
        <Row style={{ marginTop: space.sm }}>
          <Button
            flex
            label={t('home.startTraining')}
            onPress={() => (practiceToday ? nav.navigate('Session', { dayIndex: practiceToday.day }) : nav.navigate('Coach'))}
          />
          <Button flex variant="secondary" label={t('home.viewPlan')} onPress={() => nav.navigate('Coach')} />
        </Row>
      </Card>

      <Card>
        <Eyebrow>{t('home.thisWeek')}</Eyebrow>
        {!plan && <Body muted>{t('home.openCoach')}</Body>}
        {plan && (
          <Row style={{ justifyContent: 'space-between', gap: 4 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const sessions = plan.sessions.filter((s) => s.day === i);
              const isToday = i === today;
              const summary = sessions.length ? sessions.map((s) => sessionTitle(s, t)).join(', ') : t('home.rest');
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(`dayName.${i}`)}: ${summary}`}
                  onPress={() => {
                    const s = sessions.find((x) => x.kind !== 'round');
                    if (s) nav.navigate('Session', { dayIndex: i });
                    else nav.navigate('Coach');
                  }}
                  style={{
                    flex: 1, alignItems: 'center', gap: 6, paddingVertical: space.sm, borderRadius: 14,
                    borderWidth: 1, borderColor: isToday ? c.accent : 'transparent',
                    backgroundColor: isToday ? c.cardAlt : 'transparent',
                  }}
                >
                  <Text style={{ color: isToday ? c.accent : c.muted, fontWeight: '800', fontSize: 12 }}>{t(`dayShort.${i}`)}</Text>
                  {sessions.length === 0 ? (
                    <Text style={{ color: c.line, fontSize: 18 }}>·</Text>
                  ) : (
                    sessions.map((s, k) => (
                      <Text key={k} style={{ color: s.kind === 'round' ? c.primary : c.text, fontSize: 18 }}>{KIND_GLYPH[s.kind]}</Text>
                    ))
                  )}
                </Pressable>
              );
            })}
          </Row>
        )}
        {plan && <Body muted style={{ fontSize: 12 }}>{t('home.legend')}</Body>}
      </Card>
    </Screen>
  );
}
