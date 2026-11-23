import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Field, H1, H2, Row, Screen } from '../components/ui';
import { createRound, getProfile, listRounds, shotsForRound } from '../db';
import { listCourses, saveRoundPlan } from '../db/courses';
import { Course, courseHandicap, coursePar, Gender, ratingFor, teeLength } from '../domain/courses';
import { roundScore } from '../domain/strokesGained';
import type { Round } from '../domain/types';
import { useI18n } from '../i18n';
import type { RootStackParams } from '../navigation';
import { useTheme } from '../theme';
import { useLoad } from '../useLoad';

export function Play() {
  const { c } = useTheme();
  const { t, date, len } = useI18n();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [course, setCourse] = useState('');
  const [holes, setHoles] = useState<9 | 18>(18);
  const [kind, setKind] = useState<Round['kind']>('practice');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teeId, setTeeId] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>('men');
  const { data: rounds } = useLoad(async () => {
    const rs = await listRounds();
    return Promise.all(rs.map(async (r) => ({ r, score: roundScore(await shotsForRound(r.id)) })));
  });
  const { data: courses } = useLoad(listCourses);
  const { data: profile } = useLoad(getProfile);

  const picked: Course | undefined = courses?.find((c) => c.id === courseId);
  const tee = picked?.tees.find((x) => x.id === teeId) ?? picked?.tees[0];
  const genders = (tee?.ratings.map((r) => r.gender) ?? []) as Gender[];
  const effGender: Gender = genders.includes(gender) ? gender : genders[0] ?? 'men';
  const rating = tee ? ratingFor(tee, effGender) : undefined;

  const start = async () => {
    const id = await createRound({
      course: picked ? picked.name : course.trim() || t('play.unnamed'),
      playedAt: new Date().toISOString(),
      holes: picked ? picked.holes.length : holes,
      parTotal: picked ? coursePar(picked) : 0,
      kind,
    });
    if (picked && tee) await saveRoundPlan(id, { courseId: picked.id, teeId: tee.id, gender: effGender });
    nav.navigate('Round', { roundId: id });
  };

  return (
    <Screen>
      <H1>{t('play.title')}</H1>
      <Card>
        <H2>{t('play.new')}</H2>
        <Body muted>{t('course.pick')}</Body>
        <ChipRow>
          {courses?.map((c) => (
            <Chip key={c.id} label={c.name} selected={courseId === c.id} onPress={() => { setCourseId(c.id); setTeeId(null); }} />
          ))}
          <Chip label={t('course.manual')} selected={!picked} onPress={() => setCourseId(null)} />
        </ChipRow>
        {picked && tee && (
          <>
            <Body muted>{t('course.tee')}</Body>
            <ChipRow>
              {picked.tees.map((x) => (
                <Chip key={x.id} label={`${t(`tee.${x.color}`)} · ${len(teeLength(x))}`} selected={tee.id === x.id} onPress={() => setTeeId(x.id)} />
              ))}
            </ChipRow>
            {genders.length > 1 && (
              <>
                <Body muted>{t('course.gender')}</Body>
                <ChipRow>
                  {genders.map((g) => (
                    <Chip key={g} label={t(`gender.${g}`)} selected={effGender === g} onPress={() => setGender(g)} />
                  ))}
                </ChipRow>
              </>
            )}
            {rating && (
              <>
                <Body>{t('course.teeInfo', { par: coursePar(picked), len: len(teeLength(tee)) })} · {t('course.rating', { cr: { n: rating.cr, d: 1 }, sr: rating.sr })}</Body>
                {profile && <Body muted>{t('course.hcp', { n: courseHandicap(profile.handicap, rating, coursePar(picked)) })}</Body>}
              </>
            )}
            {!picked.builtin && (
              <Button label={t('course.edit')} variant="secondary" onPress={() => nav.navigate('AddCourse', { courseId: picked.id })} />
            )}
          </>
        )}
        {!picked && <Field label={t('play.course')} value={course} onChangeText={setCourse} placeholder={t('play.coursePh')} />}
        <Button label={t('course.add')} variant="secondary" onPress={() => nav.navigate('AddCourse')} />
        <ChipRow>
          {!picked && (
            <>
              <Chip label={t('play.h18')} selected={holes === 18} onPress={() => setHoles(18)} />
              <Chip label={t('play.h9')} selected={holes === 9} onPress={() => setHoles(9)} />
            </>
          )}
          <Chip label={t('play.kind.practice')} selected={kind === 'practice'} onPress={() => setKind('practice')} />
          <Chip label={t('play.kind.competition')} selected={kind === 'competition'} onPress={() => setKind('competition')} />
        </ChipRow>
        <Button label={t('play.start')} onPress={start} />
      </Card>
      {rounds && rounds.length > 0 && <H2>{t('play.past')}</H2>}
      {rounds?.map(({ r, score }) => (
        <Pressable key={r.id} onPress={() => nav.navigate('RoundReview', { roundId: r.id })} accessibilityRole="button">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700' }}>{r.course}</Body>
              <Text style={{ fontWeight: '800', fontSize: 20, color: c.accent }}>{score || '–'}</Text>
            </Row>
            <Body muted>{t('play.meta', { date: date(r.playedAt), holes: r.holes, kind: t(`play.kind.${r.kind}`) })}</Body>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
