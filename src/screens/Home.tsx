import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Eyebrow, H1, Row, Screen, StatCard } from '../components/ui';
import { getPlan, listDrillLogs, shotsByRound } from '../db';
import { diagnose } from '../domain/coach';
import { averageScore, averageStrokesGained, formatMinutes, greeting, practiceMinutesThisWeek } from '../domain/stats';
import { PlannedSession, Profile, SG_LABEL } from '../domain/types';
import type { RootStackParams, TabParams } from '../navigation';
import { space, useTheme } from '../theme';
import { useLoad } from '../useLoad';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<TabParams, 'Home'>, NativeStackNavigationProp<RootStackParams>>;

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const todayIndex = () => (new Date().getDay() + 6) % 7;

const KIND_GLYPH: Record<PlannedSession['kind'], string> = { practice: '◎', gym: '⚡', round: '⛳', recovery: '○' };

export function Home({ profile }: { profile: Profile }) {
  const { c, isDark, setMode } = useTheme();
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

  // Coach message: built only from the player's own data.
  const coachText = !diag
    ? ''
    : diag.messages.length
      ? diag.messages.slice(0, 2).join(' ')
      : 'Record a round to get your first diagnosis.';

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Eyebrow accent>{greeting()}{profile.name ? `, ${profile.name}` : ''}</Eyebrow>
          <H1>Your game. Decoded.</H1>
          <Body muted>Your journey to a {profile.targetHandicap} handicap continues.</Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={() => setMode(isDark ? 'light' : 'dark')}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 22, color: c.text }}>{isDark ? '☀' : '☾'}</Text>
        </Pressable>
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <StatCard label="Handicap" value={String(profile.handicap)} note={`Target ${profile.targetHandicap}`} />
        <StatCard
          label="Avg. score"
          value={data?.score ? data.score.avg.toFixed(1) : '–'}
          note={data?.score ? `Last ${data.score.n} complete round${data.score.n === 1 ? '' : 's'}` : 'No complete rounds yet'}
        />
        <StatCard
          label="Strokes gained"
          value={data?.sg ? `${data.sg.avg > 0 ? '+' : ''}${data.sg.avg.toFixed(1)}` : '–'}
          note={data?.sg ? `Per round, last ${data.sg.n}` : 'Track a round to see this'}
        />
        <StatCard
          label="Practice"
          value={formatMinutes(data ? practiceMinutesThisWeek(data.logs) : 0)}
          note="Logged this week"
        />
      </View>

      <Card style={{ borderColor: c.accent, backgroundColor: c.cardAlt }}>
        <Eyebrow accent>Your AI coach</Eyebrow>
        <Body style={{ fontSize: 18, lineHeight: 26 }}>{coachText}</Body>
        {plan && <Body muted>This week’s priority: {SG_LABEL[plan.focus]}</Body>}
        <Row style={{ marginTop: space.sm }}>
          <Button
            flex
            label="START TRAINING"
            onPress={() => (practiceToday ? nav.navigate('Session', { dayIndex: practiceToday.day }) : nav.navigate('Coach'))}
          />
          <Button flex variant="secondary" label="VIEW MY PLAN" onPress={() => nav.navigate('Coach')} />
        </Row>
      </Card>

      <Card>
        <Eyebrow>This week</Eyebrow>
        {!plan && <Body muted>Open My Coach to build your weekly plan.</Body>}
        {plan && (
          <Row style={{ justifyContent: 'space-between', gap: 4 }}>
            {DAYS.map((d, i) => {
              const sessions = plan.sessions.filter((s) => s.day === i);
              const isToday = i === today;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${i + 1}`}
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
                  <Text style={{ color: isToday ? c.accent : c.muted, fontWeight: '800', fontSize: 12 }}>{d}</Text>
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
        {plan && <Body muted style={{ fontSize: 12 }}>◎ practice   ⚡ gym   ⛳ round   ○ recovery</Body>}
      </Card>
    </Screen>
  );
}
