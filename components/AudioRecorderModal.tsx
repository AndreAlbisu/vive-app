import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { ViveFonts } from '@/constants/theme';

const MAX_BYTES = 30 * 1024 * 1024;

export type RecordedAsset = { name: string; uri: string; mimeType: string; size: number };

function fmtTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Grabador de audio in-app (expo-audio). Flujo: grabar → parar → escuchar
 * antes de usar → "Usar esta grabación" (o "Grabar de nuevo"). Produce un
 * asset con la misma forma que el DocumentPicker (pickAudio en
 * coach-recurso-nuevo.tsx), así el resto del formulario no cambia.
 */
export function AudioRecorderModal({
  visible,
  onClose,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (asset: RecordedAsset) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview'>('idle');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Solo sondear rápido mientras graba de verdad — si no, sigue corriendo cada
  // 200ms durante la reproducción de la previa y compite con el AudioPlayer.
  const recState = useAudioRecorderState(recorder, phase === 'recording' ? 200 : 60000);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const player = useAudioPlayer(recordedUri ?? undefined);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!visible) return;
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setRecordedUri(null);
      setError(null);
    }
  }, [visible]);

  async function start() {
    setError(null);
    const { status } = await requestRecordingPermissionsAsync();
    if (status !== 'granted') {
      setError('Necesitamos permiso de micrófono para grabar.');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  }

  async function stop() {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError('No se pudo guardar la grabación. Probá de nuevo.');
      setPhase('idle');
      return;
    }
    const file = new File(uri);
    if (file.size > MAX_BYTES) {
      setError('La grabación superó los 30 MB — grabá algo más corto.');
      setPhase('idle');
      return;
    }
    setRecordedUri(uri);
    setPhase('preview');
  }

  function discard() {
    player.pause();
    setRecordedUri(null);
    setPhase('idle');
  }

  function confirm() {
    if (!recordedUri) return;
    const file = new File(recordedUri);
    onDone({ name: `grabacion-${Date.now()}.m4a`, uri: recordedUri, mimeType: 'audio/m4a', size: file.size });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>Grabar audio</Text>

        {error && <Text style={s.error}>{error}</Text>}

        {phase !== 'preview' ? (
          <>
            <View style={s.timerWrap}>
              <Text style={s.timer}>{fmtTime(recState.durationMillis ?? 0)}</Text>
              {phase === 'recording' && <View style={s.recDot} />}
            </View>

            <TouchableOpacity
              style={[s.recBtn, phase === 'recording' && s.recBtnActive]}
              onPress={phase === 'recording' ? stop : start}
              activeOpacity={0.85}>
              <Ionicons name={phase === 'recording' ? 'stop' : 'mic'} size={30} color="#fff" />
            </TouchableOpacity>
            <Text style={s.hint}>
              {phase === 'recording' ? 'Tocá para terminar' : 'Tocá para empezar a grabar'}
            </Text>
          </>
        ) : (
          <>
            <View style={s.previewRow}>
              <TouchableOpacity
                style={s.playBtn}
                onPress={() => (playerStatus.playing ? player.pause() : player.play())}
                activeOpacity={0.85}>
                <Ionicons name={playerStatus.playing ? 'pause' : 'play'} size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={s.previewTime}>
                {fmtTime((playerStatus.currentTime ?? 0) * 1000)} / {fmtTime((playerStatus.duration ?? 0) * 1000)}
              </Text>
            </View>

            <View style={s.previewActions}>
              <TouchableOpacity style={s.discardBtn} onPress={discard} activeOpacity={0.8}>
                <Text style={s.discardBtnText}>Grabar de nuevo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={confirm} activeOpacity={0.85}>
                <Text style={s.confirmBtnText}>Usar esta grabación</Text>
              </TouchableOpacity>
            </View>
          </>
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
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
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
    marginBottom: 20,
  },
  error: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: '#B5533A',
    textAlign: 'center',
    marginBottom: 14,
  },
  timerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  timer: {
    fontFamily: ViveFonts.semibold,
    fontSize: 32,
    color: '#3A4F2A',
    fontVariant: ['tabular-nums'],
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E05252',
  },
  recBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#C1694F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  recBtnActive: {
    backgroundColor: '#B5533A',
  },
  hint: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: '#87835C',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3A4F2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTime: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: '#3A4F2A',
    fontVariant: ['tabular-nums'],
  },
  previewActions: {
    width: '100%',
    gap: 10,
  },
  discardBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58,79,42,0.25)',
  },
  discardBtnText: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: '#3A4F2A',
  },
  confirmBtn: {
    backgroundColor: '#3A4F2A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#F3EEDF',
  },
});
