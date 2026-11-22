import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Eyebrow, H2, Row } from '../components/ui';
import { saveImport } from '../db/clubs';
import { DISTANCE_CLUBS } from '../domain/clubs';
import {
  buildPreview, Field, isZip, Mapping, MISHIT_HIGH, MISHIT_LOW, parseDelimited, parseXlsxSheets, pickBestSheet, Sheet, toTable, Unit,
} from '../domain/importer';
import { space, useTheme } from '../theme';

const MAX_BYTES = 8 * 1024 * 1024;

const FIELD_LABEL: Record<'club' | 'carry' | 'total', string> = {
  club: 'Club column',
  carry: 'Carry column',
  total: 'Total distance column (optional)',
};

export function ImportClubData({ onSaved }: { onSaved: () => void }) {
  const { c } = useTheme();
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [sessionUnits, setSessionUnits] = useState<Record<string, Unit>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [filterMishits, setFilterMishits] = useState(true);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const table = useMemo(() => (sheets[sheetIdx] ? toTable(sheets[sheetIdx].rows) : null), [sheets, sheetIdx]);
  const preview = useMemo(
    () =>
      table
        ? buildPreview(table, {
            mapping: mapping ?? undefined,
            unit: unit ?? undefined,
            filterMishits,
            sessionUnits: Object.keys(sessionUnits).length ? sessionUnits : undefined,
            excludedSessions: excluded,
            aliases,
          })
        : null,
    [table, mapping, unit, filterMishits, sessionUnits, excluded, aliases],
  );

  const resetChoices = () => {
    setMapping(null); setUnit(null); setSessionUnits({}); setExcluded([]); setAliases({}); setSkip(new Set()); setShowCols(false);
  };
  const reset = () => { setSheets([]); setSheetIdx(0); setFileName(''); resetChoices(); };

  const pick = async () => {
    setError(''); setMessage('');
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setBusy(true);
      if (/\.xls$/i.test(asset.name)) {
        setError('Old .xls files can’t be read. In Excel, choose Save As and pick .xlsx or .csv, then try again.');
        return;
      }
      if (asset.size && asset.size > MAX_BYTES) {
        setError('That file is larger than 8 MB. Export just one session and try again.');
        return;
      }
      const file = new File(asset.uri);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const found: Sheet[] = isZip(bytes) ? parseXlsxSheets(bytes) : [{ name: asset.name, rows: parseDelimited(await file.text()) }];
      if (!found.some((s) => s.rows.length >= 2)) {
        setError('The file looks empty. Check that it holds shot data with a header row.');
        return;
      }
      reset();
      setFileName(asset.name);
      setSheets(found);
      setSheetIdx(pickBestSheet(found));
    } catch (e) {
      setError('Could not read that file. Try exporting it again as CSV or .xlsx.');
      console.warn('import failed', e);
    } finally {
      setBusy(false);
    }
  };

  const effMapping = preview?.mapping ?? {};
  const setCol = (f: Field, idx: number | undefined) => setMapping({ ...effMapping, [f]: idx });
  const needsColumns = !!preview && (effMapping.club === undefined || effMapping.carry === undefined);

  const chosen = preview?.clubs.filter((a) => !skip.has(a.club)) ?? [];
  const toggle = (club: string) => {
    const next = new Set(skip);
    if (next.has(club)) next.delete(club); else next.add(club);
    setSkip(next);
  };
  const toggleSession = (name: string) =>
    setExcluded(excluded.includes(name) ? excluded.filter((n) => n !== name) : [...excluded, name]);
  const setAllUnits = (u: Unit) => {
    const all: Record<string, Unit> = {};
    preview?.sessions.forEach((s) => { all[s.name] = u; });
    setSessionUnits(all);
  };

  const save = async () => {
    if (!preview || !chosen.length) return;
    setBusy(true);
    try {
      const keep = new Set(chosen.map((a) => a.club));
      await saveImport({ fileName, averages: chosen, shots: preview.shots.filter((s) => keep.has(s.club)) });
      setMessage(`Saved ${chosen.length} club${chosen.length === 1 ? '' : 's'} from ${fileName}. Open any club below to see the entry.`);
      reset();
      onSaved();
    } catch (e) {
      setError('Could not save the import. Please try again.');
      console.warn('save failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <H2>Import from a file</H2>
      <Body muted>
        Export a session from your launch monitor as CSV or Excel (.xlsx) and choose it here. The app reads the club and carry
        columns, averages each club, and lets you review before saving.
      </Body>
      <Button label={sheets.length ? 'Choose a different file' : 'Choose CSV or Excel file'} variant={sheets.length ? 'secondary' : 'primary'} onPress={pick} disabled={busy} />
      {!!error && <Text style={{ color: c.bad, fontSize: 14 }} accessibilityLiveRegion="polite">{error}</Text>}
      {!!message && <Text style={{ color: c.good, fontSize: 14 }} accessibilityLiveRegion="polite">{message}</Text>}

      {preview && table && (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Eyebrow>{fileName}</Eyebrow>

          {sheets.length > 1 && (
            <View style={{ gap: space.sm }}>
              <Body muted>This workbook has {sheets.length} sheets. Sheets can repeat the same shots, so import one at a time.</Body>
              <ChipRow>
                {sheets.map((s, i) => (
                  <Chip key={i} label={s.name} selected={sheetIdx === i} onPress={() => { setSheetIdx(i); resetChoices(); }} />
                ))}
              </ChipRow>
            </View>
          )}

          <Body muted>
            {preview.rowsRead} rows read · {preview.rowsUsed} shots matched to clubs
          </Body>

          {preview.warnings.map((w, i) => (
            <Text key={i} style={{ color: c.bad, fontSize: 14 }}>{w}</Text>
          ))}

          {preview.sessions.length === 0 ? (
            <View style={{ gap: space.sm }}>
              <Body muted>Distances in the file are</Body>
              <ChipRow>
                <Chip label="Yards" selected={preview.unit === 'yards'} onPress={() => setUnit('yards')} />
                <Chip label="Meters (converted to yards)" selected={preview.unit === 'meters'} onPress={() => setUnit('meters')} />
              </ChipRow>
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <Body muted>Sessions in this sheet. Tick the ones to import and set each one’s units.</Body>
              <ChipRow>
                <Chip label="Set all to yards" onPress={() => setAllUnits('yards')} />
                <Chip label="Set all to meters" onPress={() => setAllUnits('meters')} />
              </ChipRow>
              {preview.sessions.map((s) => (
                <View key={s.name} style={{ gap: space.xs, opacity: s.included ? 1 : 0.5 }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: s.included }}
                    onPress={() => toggleSession(s.name)}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Row>
                      <Text style={{ color: c.accent, fontSize: 20, width: 28 }}>{s.included ? '☑' : '☐'}</Text>
                      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{s.name}</Text>
                      <Text style={{ color: c.muted, fontSize: 12 }}>{s.shots} shots</Text>
                    </Row>
                  </Pressable>
                  {s.included && (
                    <ChipRow>
                      <Chip label="Yards" selected={s.unit === 'yards'} onPress={() => setSessionUnits({ ...sessionUnits, [s.name]: 'yards' })} />
                      <Chip label="Meters" selected={s.unit === 'meters'} onPress={() => setSessionUnits({ ...sessionUnits, [s.name]: 'meters' })} />
                    </ChipRow>
                  )}
                </View>
              ))}
            </View>
          )}

          {(showCols || needsColumns) ? (
            <View style={{ gap: space.sm }}>
              {(['club', 'carry', 'total'] as const).map((f) => (
                <View key={f} style={{ gap: space.xs }}>
                  <Body muted>{FIELD_LABEL[f]}</Body>
                  <ChipRow>
                    {f === 'total' && <Chip label="None" selected={effMapping.total === undefined} onPress={() => setCol('total', undefined)} />}
                    {table.headers.map((h, i) => (h ? (
                      <Chip key={i} label={h} selected={effMapping[f] === i} onPress={() => setCol(f, i)} />
                    ) : null))}
                  </ChipRow>
                </View>
              ))}
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setShowCols(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: c.accent, fontWeight: '700' }}>Columns look wrong? Change them</Text>
            </Pressable>
          )}

          {preview.unmatched.map((u) => (
            <View key={u.name} style={{ gap: space.xs }}>
              <Body muted>“{u.name}” ({u.count} shots) isn’t a club name the app knows. Which club is it?</Body>
              <ChipRow>
                {DISTANCE_CLUBS.map((cl) => (
                  <Chip key={cl} label={cl} onPress={() => setAliases({ ...aliases, [u.name]: cl })} />
                ))}
                <Chip label="Skip these" onPress={() => setAliases({ ...aliases, [u.name]: '' })} />
              </ChipRow>
            </View>
          ))}

          <ChipRow>
            <Chip
              label={filterMishits ? 'Ignoring obvious mishits' : 'Counting every shot'}
              selected={filterMishits}
              onPress={() => setFilterMishits(!filterMishits)}
            />
          </ChipRow>
          {filterMishits && (
            <Body muted style={{ fontSize: 12 }}>
              A shot is left out when its carry is more than {Math.round((1 - MISHIT_LOW) * 100)}% below or {Math.round((MISHIT_HIGH - 1) * 100)}% above
              that club’s median. Needs 3 or more shots with the club. Left-out shots are still kept in the saved data.
            </Body>
          )}

          {preview.clubs.length === 0 && !needsColumns && preview.unmatched.length === 0 && (
            <Body muted>No clubs were recognised. Check the club column, or that the file has shots in it.</Body>
          )}

          {preview.clubs.map((a) => {
            const on = !skip.has(a.club);
            return (
              <Pressable
                key={a.club}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${a.club}, ${Math.round(a.carry)} yards`}
                onPress={() => toggle(a.club)}
                style={{ minHeight: 52, justifyContent: 'center', opacity: on ? 1 : 0.5 }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: c.accent, fontSize: 20, width: 28 }}>{on ? '☑' : '☐'}</Text>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', width: 64 }}>{a.club}</Text>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', flex: 1 }}>{Math.round(a.carry)} yd</Text>
                  <Text style={{ color: c.muted, fontSize: 12, textAlign: 'right' }}>
                    {a.used === a.shots ? `${a.shots} shots` : `${a.used} of ${a.shots} shots`}
                  </Text>
                </Row>
              </Pressable>
            );
          })}

          <Button label={`Save ${chosen.length} club${chosen.length === 1 ? '' : 's'}`} onPress={save} disabled={busy || chosen.length === 0} />
        </View>
      )}
    </Card>
  );
}
