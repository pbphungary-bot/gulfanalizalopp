import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Eyebrow, Field, H2, Row } from '../components/ui';
import { addClubDistance, deleteClubDistance, listClubDistances } from '../db/clubs';
import { DISTANCE_CLUBS, DistanceSource, gaps, history, summarize } from '../domain/clubs';
import { useI18n } from '../i18n';
import { space, useTheme } from '../theme';
import { useLoad } from '../useLoad';
import { ImportClubData } from './ImportClubData';

export function ClubDistances() {
  const { c } = useTheme();
  const { t, tn, date, len, lenNum, unitLong, parseLen } = useI18n();
  const { data, reload } = useLoad(listClubDistances);
  const [club, setClub] = useState('7i');
  const [carry, setCarry] = useState('');
  const [total, setTotal] = useState('');
  const [source, setSource] = useState<DistanceSource>('manual');
  const [shots, setShots] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const entries = data ?? [];
  const summaries = summarize(entries);
  const gapList = gaps(summaries);
  const recorded = summaries.filter((s) => s.latest).length;

  const save = async () => {
    const cy = parseLen(carry);
    const ty = total.trim() === '' ? null : parseLen(total);
    const sh = shots.trim() === '' ? null : parseInt(shots, 10);
    if (Number.isNaN(cy) || cy < 18 || cy > 370) {
      Alert.alert(t('cd.errCarryTitle'), t('cd.errCarryBody', { unit: unitLong, lo: Math.round(lenNum(18)), hi: Math.round(lenNum(370)) }));
      return;
    }
    if (ty !== null && (Number.isNaN(ty) || ty < cy || ty > 460)) {
      Alert.alert(t('cd.errTotalTitle'), t('cd.errTotalBody'));
      return;
    }
    if (sh !== null && (Number.isNaN(sh) || sh < 1)) {
      Alert.alert(t('cd.errShotsTitle'), t('cd.errShotsBody'));
      return;
    }
    await addClubDistance({
      club, carry: cy, total: ty, source, shots: source === 'monitor' ? sh : null,
      recordedAt: new Date().toISOString(), note: note.trim(),
    });
    setCarry(''); setTotal(''); setShots(''); setNote('');
    setOpen(club);
    reload();
  };

  const remove = (id: number) =>
    Alert.alert(t('cd.delTitle'), t('cd.delBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteClubDistance(id); reload(); } },
    ]);

  return (
    <>
      <ImportClubData onSaved={reload} />

      <Card>
        <H2>{t('cd.addTitle')}</H2>
        <Body muted>{t('cd.addIntro')}</Body>
        <Body muted>{t('cd.club')}</Body>
        <ChipRow>
          {DISTANCE_CLUBS.map((cl) => (
            <Chip key={cl} label={cl} selected={club === cl} onPress={() => setClub(cl)} />
          ))}
        </ChipRow>
        <ChipRow>
          <Chip label={t('cd.byHand')} selected={source === 'manual'} onPress={() => setSource('manual')} />
          <Chip label={t('cd.monitorAvg')} selected={source === 'monitor'} onPress={() => setSource('monitor')} />
        </ChipRow>
        <Field label={t('cd.carry', { unit: unitLong })} value={carry} onChangeText={setCarry} keyboardType="decimal-pad" />
        <Field label={t('cd.total', { unit: unitLong })} value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
        {source === 'monitor' && (
          <Field label={t('cd.shotsCount')} value={shots} onChangeText={setShots} keyboardType="numeric" />
        )}
        <Field label={t('cd.note')} value={note} onChangeText={setNote} placeholder={t('cd.noteEx')} />
        <Button label={t('cd.saveClub', { club })} onPress={save} disabled={carry.trim() === ''} />
      </Card>

      <Card>
        <H2>{t('cd.bag')}</H2>
        {recorded === 0 && <Body muted>{t('cd.none')}</Body>}
        {summaries.map((s) => {
          const isOpen = open === s.club;
          return (
            <View key={s.club}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cd.history', { club: s.club })}
                onPress={() => setOpen(isOpen ? null : s.club)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', width: 72 }}>{s.club}</Text>
                  <Text style={{ color: s.latest ? c.text : c.muted, fontSize: 18, fontWeight: '800', flex: 1 }}>
                    {s.latest ? len(s.latest.carry) : '–'}
                  </Text>
                  {s.delta !== null && s.delta !== 0 && (
                    <Text style={{ color: s.delta > 0 ? c.good : c.bad, fontWeight: '700' }}>
                      {s.delta > 0 ? '+' : ''}{Math.round(lenNum(s.delta))}
                    </Text>
                  )}
                  <Text style={{ color: c.muted, fontSize: 12, width: 92, textAlign: 'right' }}>
                    {s.latest ? date(s.latest.recordedAt) : ''}
                  </Text>
                </Row>
              </Pressable>
              {isOpen && (
                <View style={{ gap: space.sm, paddingBottom: space.md }}>
                  {history(entries, s.club).length === 0 && <Body muted>{t('cd.nothing', { club: s.club })}</Body>}
                  {history(entries, s.club).map((e) => (
                    <Row key={e.id} style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text }}>
                          {t('cd.carryLine', { d: len(e.carry) })}{e.total ? ` · ${t('cd.totalLine', { d: len(e.total) })}` : ''}
                        </Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                          {date(e.recordedAt)} · {e.source === 'monitor' ? (e.shots ? t('cd.monitorShots', { n: e.shots }) : t('cd.monitor')) : t('cd.typed')}
                          {e.note ? ` · ${e.note}` : ''}
                        </Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('cd.delEntry')} onPress={() => remove(e.id)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.bad, fontSize: 18 }}>✕</Text>
                      </Pressable>
                    </Row>
                  ))}
                  <Button label={t('cd.update', { club: s.club })} variant="secondary" onPress={() => setClub(s.club)} />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {gapList.length > 0 && (
        <Card>
          <H2>{t('cd.gaps')}</H2>
          <Body muted>{t('cd.gapsIntro')}</Body>
          {gapList.map((g) => (
            <View key={`${g.from}-${g.to}`} style={{ paddingVertical: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body>{g.from} → {g.to}</Body>
                <Text style={{ color: g.flag ? c.bad : c.text, fontWeight: '800' }}>{len(g.metres)}</Text>
              </Row>
              {g.flag && <Eyebrow>{t(`gap.${g.flag}`)}</Eyebrow>}
              {g.skipped > 0 && <Body muted style={{ fontSize: 12 }}>{tn('cd.skipped', g.skipped)}</Body>}
            </View>
          ))}
        </Card>
      )}
    </>
  );
}
