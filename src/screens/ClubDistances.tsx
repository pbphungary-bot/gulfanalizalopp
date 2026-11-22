import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Eyebrow, Field, H2, Row } from '../components/ui';
import { addClubDistance, deleteClubDistance, listClubDistances } from '../db/clubs';
import { DISTANCE_CLUBS, DistanceSource, GAP_TEXT, gaps, history, summarize } from '../domain/clubs';
import { space, useTheme } from '../theme';
import { useLoad } from '../useLoad';
import { ImportClubData } from './ImportClubData';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

export function ClubDistances() {
  const { c } = useTheme();
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
    const cy = parseFloat(carry);
    const ty = total.trim() === '' ? null : parseFloat(total);
    const sh = shots.trim() === '' ? null : parseInt(shots, 10);
    if (Number.isNaN(cy) || cy < 20 || cy > 400) {
      Alert.alert('Check the carry distance', 'Enter the carry in yards, between 20 and 400.');
      return;
    }
    if (ty !== null && (Number.isNaN(ty) || ty < cy || ty > 500)) {
      Alert.alert('Check the total distance', 'Total can’t be shorter than carry. Leave it empty if you don’t know it.');
      return;
    }
    if (sh !== null && (Number.isNaN(sh) || sh < 1)) {
      Alert.alert('Check the shot count', 'Enter how many shots the average is based on, or leave it empty.');
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
    Alert.alert('Delete this entry?', 'This removes it from the club’s history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteClubDistance(id); reload(); } },
    ]);

  return (
    <>
      <ImportClubData onSaved={reload} />

      <Card>
        <H2>Add a distance</H2>
        <Body muted>Type it in, or enter the average from your launch monitor. Add a new one whenever your numbers change.</Body>
        <Body muted>Club</Body>
        <ChipRow>
          {DISTANCE_CLUBS.map((cl) => (
            <Chip key={cl} label={cl} selected={club === cl} onPress={() => setClub(cl)} />
          ))}
        </ChipRow>
        <ChipRow>
          <Chip label="Typed in by hand" selected={source === 'manual'} onPress={() => setSource('manual')} />
          <Chip label="Launch monitor average" selected={source === 'monitor'} onPress={() => setSource('monitor')} />
        </ChipRow>
        <Field label="Carry (yards)" value={carry} onChangeText={setCarry} keyboardType="numeric" />
        <Field label="Total (yards, optional)" value={total} onChangeText={setTotal} keyboardType="numeric" />
        {source === 'monitor' && (
          <Field label="Number of shots in the average (optional)" value={shots} onChangeText={setShots} keyboardType="numeric" />
        )}
        <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. indoors, windy, new shafts" />
        <Button label={`Save ${club} distance`} onPress={save} disabled={carry.trim() === ''} />
      </Card>

      <Card>
        <H2>Your bag</H2>
        {recorded === 0 && <Body muted>No distances yet. Add your first club above.</Body>}
        {summaries.map((s) => {
          const isOpen = open === s.club;
          return (
            <View key={s.club}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${s.club} history`}
                onPress={() => setOpen(isOpen ? null : s.club)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', width: 72 }}>{s.club}</Text>
                  <Text style={{ color: s.latest ? c.text : c.muted, fontSize: 18, fontWeight: '800', flex: 1 }}>
                    {s.latest ? `${Math.round(s.latest.carry)} yd` : '–'}
                  </Text>
                  {s.delta !== null && s.delta !== 0 && (
                    <Text style={{ color: s.delta > 0 ? c.good : c.bad, fontWeight: '700' }}>
                      {s.delta > 0 ? '+' : ''}{Math.round(s.delta)}
                    </Text>
                  )}
                  <Text style={{ color: c.muted, fontSize: 12, width: 78, textAlign: 'right' }}>
                    {s.latest ? fmtDate(s.latest.recordedAt) : ''}
                  </Text>
                </Row>
              </Pressable>
              {isOpen && (
                <View style={{ gap: space.sm, paddingBottom: space.md }}>
                  {history(entries, s.club).length === 0 && <Body muted>Nothing recorded for {s.club} yet.</Body>}
                  {history(entries, s.club).map((e) => (
                    <Row key={e.id} style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text }}>
                          {Math.round(e.carry)} yd carry{e.total ? ` · ${Math.round(e.total)} total` : ''}
                        </Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                          {fmtDate(e.recordedAt)} · {e.source === 'monitor' ? `launch monitor${e.shots ? `, ${e.shots} shots` : ''}` : 'typed in'}
                          {e.note ? ` · ${e.note}` : ''}
                        </Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel="Delete entry" onPress={() => remove(e.id)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.bad, fontSize: 18 }}>✕</Text>
                      </Pressable>
                    </Row>
                  ))}
                  <Button label={`Update ${s.club}`} variant="secondary" onPress={() => setClub(s.club)} />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {gapList.length > 0 && (
        <Card>
          <H2>Gaps between clubs</H2>
          <Body muted>Based on each club’s latest carry. Flags are rules of thumb, not equipment advice.</Body>
          {gapList.map((g) => (
            <View key={`${g.from}-${g.to}`} style={{ paddingVertical: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body>{g.from} → {g.to}</Body>
                <Text style={{ color: g.flag ? c.bad : c.text, fontWeight: '800' }}>{Math.round(g.yards)} yd</Text>
              </Row>
              {g.flag && <Eyebrow>{GAP_TEXT[g.flag]}</Eyebrow>}
              {g.skipped > 0 && <Body muted style={{ fontSize: 12 }}>{g.skipped} club{g.skipped === 1 ? '' : 's'} between these not recorded yet</Body>}
            </View>
          ))}
        </Card>
      )}
    </>
  );
}
