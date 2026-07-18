import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { saveReminder, deleteReminder, type ReminderFull } from '@/lib/resourceReminders';

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Botón de campanita para configurar un recordatorio propio (resource_reminders).
 * Reutilizable en tools de VITA (kind='tool', ref=slug) y en recursos de
 * coaches (kind='coach_resource', ref=uuid de coach_resources). Mismo criterio
 * que PinButton: pensado para el header, autocontenido (carga/toggle/sheet).
 */
export function ReminderBell({
  kind,
  ref: resourceRef,
  title,
}: {
  kind: 'tool' | 'coach_resource';
  ref: string;
  title: string;
}) {
  const { user, requestAuth } = useAuth();
  const [existing, setExisting] = useState<ReminderFull | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    supabase
      .from('resource_reminders')
      .select('id, kind, ref, title, days, hour, minute, enabled, created_at')
      .eq('user_id', user.id)
      .eq('kind', kind)
      .eq('ref', resourceRef)
      .maybeSingle()
      .then(({ data }) => setExisting(data as ReminderFull | null));
  }, [user, kind, resourceRef]);

  useEffect(() => { load(); }, [load]);

  const active = !!existing?.enabled;

  return (
    <>
      <TouchableOpacity
        onPress={() => (user ? setSheetOpen(true) : requestAuth())}
        hitSlop={10}>
        <MaterialCommunityIcons
          name={active ? 'bell' : 'bell-outline'}
          size={21}
          color={active ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
        />
      </TouchableOpacity>

      <ReminderSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        kind={kind}
        resourceRef={resourceRef}
        title={title}
        existing={existing}
        onSaved={() => { setSheetOpen(false); load(); }}
      />
    </>
  );
}

function ReminderSheet({
  visible,
  onClose,
  kind,
  resourceRef,
  title,
  existing,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  kind: 'tool' | 'coach_resource';
  resourceRef: string;
  title: string;
  existing: ReminderFull | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hour, setHour] = useState(20);
  const [minute, setMinute] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDays(existing?.days ?? [1, 2, 3, 4, 5]);
    setHour(existing?.hour ?? 20);
    setMinute(existing?.minute ?? 0);
    setShowPicker(false);
  }, [visible, existing]);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  function onPickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    setHour(selected.getHours());
    setMinute(selected.getMinutes());
  }

  async function handleSave() {
    if (!user || days.length === 0 || saving) return;
    setSaving(true);
    await saveReminder(user.id, {
      id: existing?.id,
      kind,
      ref: resourceRef,
      title,
      days,
      hour,
      minute,
      enabled: true,
    });
    setSaving(false);
    onSaved();
  }

  async function handleDelete() {
    if (!user || !existing || saving) return;
    setSaving(true);
    await deleteReminder(user.id, existing.id);
    setSaving(false);
    onSaved();
  }

  const pickerValue = new Date();
  pickerValue.setHours(hour, minute, 0, 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>Recordatorio · {title}</Text>

        <Text style={s.label}>¿Qué días?</Text>
        <View style={s.daysRow}>
          {DAY_LABELS.map((label, i) => {
            const on = days.includes(i);
            return (
              <TouchableOpacity
                key={i}
                style={[s.dayChip, on && s.dayChipActive]}
                onPress={() => toggleDay(i)}
                activeOpacity={0.75}>
                <Text style={[s.dayChipText, on && s.dayChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.label}>¿A qué hora?</Text>
        <TouchableOpacity style={s.timeBtn} onPress={() => setShowPicker(p => !p)} activeOpacity={0.75}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={ViveColors.accent} />
          <Text style={s.timeBtnText}>{fmtTime(hour, minute)}</Text>
        </TouchableOpacity>

        {showPicker && Platform.OS === 'ios' && (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={pickerValue}
            onChange={onPickerChange}
            locale="es"
            textColor="#3A4F2A"
          />
        )}
        {showPicker && Platform.OS === 'android' && (
          <DateTimePicker mode="time" value={pickerValue} onChange={onPickerChange} />
        )}

        <TouchableOpacity
          style={[s.saveBtn, (days.length === 0 || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={days.length === 0 || saving}
          activeOpacity={0.85}>
          <Text style={s.saveBtnText}>{existing ? 'Guardar cambios' : 'Activar recordatorio'}</Text>
        </TouchableOpacity>

        {existing && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} disabled={saving} activeOpacity={0.7}>
            <Text style={s.deleteBtnText}>Desactivar recordatorio</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#F7EFE4',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(86,94,50,0.20)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 20,
    color: '#3A4F2A',
    marginBottom: 18,
  },
  label: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#3A4F2A',
    marginBottom: 10,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
  },
  dayChipActive: {
    backgroundColor: '#3A4F2A',
    borderColor: '#3A4F2A',
  },
  dayChipText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#87835C',
  },
  dayChipTextActive: {
    color: '#F3EEDF',
  },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 20,
  },
  timeBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#3A4F2A',
  },
  saveBtn: {
    backgroundColor: '#3A4F2A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(58,79,42,0.35)',
  },
  saveBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F3EEDF',
  },
  deleteBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  deleteBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: '#B5533A',
  },
});
