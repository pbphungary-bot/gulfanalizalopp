import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Card, Chip, ChipRow, Eyebrow, H2, Row } from '../components/ui';
import { saveImport } from '../db/clubs';
import {
  buildPreview, Field, isZip, Mapping, MISHIT_HIGH, MISHIT_LOW, parseDelimited, parseXlsx, Table, toTable, Unit,
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
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [filterMishits, setFilterMishits] = useState(true);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const preview = useMemo(
    () => (table ? buildPreview(table, { mapping: mapping ?? undefined, unit: unit ?? undefined, filterMishits }) : null),
    [table, mapping, unit, filterMishits],
  );

  const reset = () => {
    setTable(null); setMapping(null); setUnit(null); setSkip(new Set()); setShowCols(false); setFileName('');
  };

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
      const grid = isZip(bytes) ? parseXlsx(bytes) : parseDelimited(await file.text());
      if (grid.length < 2) {
        setError('The file looks empty. Check that it holds shot data with a header row.');
        return;
      }
      const t = toTable(grid);
      reset();
      setFileName(asset.name);
      setTable(t);
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

  const save = async () => {
    if (!preview || !chosen.length) return;
    setBusy(true);
    try {
      await saveImport({ fileName, averages: chosen, shots: preview.shots });
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
      <Button label={table ? 'Choose a different file' : 'Choose CSV or Excel file'} variant={table ? 'secondary' : 'primary'} onPress={pick} disabled={busy} />
      {!!error && <Text style={{ color: c.bad, fontSize: 14 }} accessibilityLiveRegion="polite">{error}</Text>}
      {!!message && <Text style={{ color: c.good, fontSize: 14 }} accessibilityLiveRegion="polite">{message}</Text>}

      {preview && table && (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Eyebrow>{fileName}</Eyebrow>
          <Body muted>
            {preview.rowsRead} rows read · {preview.rowsUsed} shots matched to clubs
          </Body>

          {preview.warnings.map((w, i) => (
            <Text key={i} style={{ color: c.bad, fontSize: 14 }}>{w}</Text>
          ))}

          <View style={{ gap: space.sm }}>
            <Body muted>Distances in the file are</Body>
            <ChipRow>
              <Chip label="Yards" selected={preview.unit === 'yards'} onPress={() => setUnit('yards')} />
              <Chip label="Meters (converted to yards)" selected={preview.unit === 'meters'} onPress={() => setUnit('meters')} />
            </ChipRow>
          </View>

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

          {preview.clubs.length === 0 && !needsColumns && (
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

          {preview.unmatched.length > 0 && (
            <Body muted style={{ fontSize: 12 }}>
              Not matched to a club in your bag, so skipped: {preview.unmatched.map((u) => `${u.name} (${u.count})`).join(', ')}.
            </Body>
          )}

          <Button label={`Save ${chosen.length} club${chosen.length === 1 ? '' : 's'}`} onPress={save} disabled={busy || chosen.length === 0} />
        </View>
      )}
    </Card>
  );
}
