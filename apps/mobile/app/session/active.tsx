import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useSessionStore, MediaItem } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import { formatElapsed } from '@/lib/formatters';
import { registerTimerTask, unregisterTimerTask } from '@/tasks/sessionTimerTask';
import { triggerUpload } from '@/services/uploadService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breathing animation component using Reanimated + LinearGradient
function BreathingBackground({ isPaused }: { isPaused: boolean }) {
  const progress = useSharedValue(0);
  const colorPhase = useSharedValue(0);

  useEffect(() => {
    if (!isPaused) {
      // Breathing pulse: 4 second cycle
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );

      // Slow colour shift over ~10 minutes
      colorPhase.value = withRepeat(
        withTiming(1, { duration: 600000, easing: Easing.linear }),
        -1,
        true
      );
    }
  }, [isPaused, progress, colorPhase]);

  // Derive scale from breathing progress
  const animatedStyle = useAnimatedStyle(() => {
    const scale = isPaused ? 1 : 1 + progress.value * 0.08;
    return {
      transform: [{ scale }],
      opacity: isPaused ? 0.3 : 0.85,
    };
  });

  // Inner glow style
  const innerStyle = useAnimatedStyle(() => {
    return {
      opacity: isPaused ? 0.2 : 0.6 + progress.value * 0.2,
    };
  });

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ width: '120%', height: '120%', left: '-10%', top: '-10%' }, animatedStyle]}>
        <LinearGradient
          colors={['#1a1207', '#3d2c14', '#2a1e0e', '#1a1207']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>

      {/* Secondary colour wash */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: '80%',
            height: '60%',
            borderRadius: 999,
          },
          innerStyle,
        ]}
      >
        <LinearGradient
          colors={['rgba(184,120,32,0.3)', 'rgba(160,72,53,0.25)', 'rgba(58,90,138,0.2)']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ width: '100%', height: '100%', borderRadius: 999 }}
        />
      </Animated.View>
    </View>
  );
}

function MediaThumbnail({ item }: { item: MediaItem }) {
  const getIcon = () => {
    switch (item.type) {
      case 'photo': return '📷';
      case 'video': return '🎬';
      case 'timelapse': return '⏱';
      case 'audio': return '🎙';
      case 'text_note': return '📝';
    }
  };

  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor:
          item.syncStatus === 'failed'
            ? 'rgba(192,97,74,0.6)'
            : 'rgba(255,255,255,0.15)',
        position: 'relative',
      }}
    >
      <Text style={{ fontSize: 22 }}>{getIcon()}</Text>
      {item.type === 'timelapse' && (
        <View
          style={{
            position: 'absolute',
            bottom: 3,
            right: 3,
            backgroundColor: '#4a6fa5',
            borderRadius: 4,
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>TL</Text>
        </View>
      )}
      {item.syncStatus === 'failed' && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            backgroundColor: '#c0614a',
            borderRadius: 8,
            width: 14,
            height: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>!</Text>
        </View>
      )}
    </View>
  );
}

export default function ActiveSessionScreen() {
  const store = useSessionStore();
  const {
    sessionId,
    projectName,
    elapsedSeconds,
    isPaused,
    media,
    pauseSession,
    resumeSession,
    addMedia,
    tickTimer,
    isDraft,
  } = store;
  const { user } = useAuthStore();

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Register background timer task
  useEffect(() => {
    registerTimerTask().catch(console.warn);
    return () => {
      unregisterTimerTask().catch(console.warn);
    };
  }, []);

  // Foreground timer
  useEffect(() => {
    if (!isPaused && isDraft) {
      timerRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, isDraft, tickTimer]);

  const handleEndSession = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    pauseSession();
    router.push('/session/checkout');
  };

  const handleSaveNote = () => {
    if (noteText.trim()) {
      addMedia({
        type: 'text_note',
        content: noteText.trim(),
        timestampInSession: elapsedSeconds,
      });
    }
    setNoteText('');
    setNoteModalVisible(false);
  };

  const handlePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      const newItemId = addMedia({
        type: 'photo',
        localPath: result.assets[0].uri,
        timestampInSession: elapsedSeconds,
      });
      if (user?.id && sessionId) {
        const newItem = useSessionStore.getState().media.find(m => m.id === newItemId);
        if (newItem) triggerUpload(newItem, user.id, sessionId);
      }
    }
  };

  const handleVideo = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 180, // 3 minutes
      quality: ImagePicker.UIImagePickerControllerQualityType.High,
    });

    if (!result.canceled && result.assets[0]) {
      const newItemId = addMedia({
        type: 'video',
        localPath: result.assets[0].uri,
        duration: result.assets[0].duration ?? undefined,
        timestampInSession: elapsedSeconds,
      });
      if (user?.id && sessionId) {
        const newItem = useSessionStore.getState().media.find(m => m.id === newItemId);
        if (newItem) triggerUpload(newItem, user.id, sessionId);
      }
    }
  };

  const handleTimelapse = async () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'iOS only in Phase 1',
        'Time-lapse is available on iOS. Use video clips to capture your process.'
      );
      return;
    }

    // iOS: launch camera (timelapse mode — user selects in native camera UI)
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: ImagePicker.UIImagePickerControllerQualityType.High,
    });

    if (!result.canceled && result.assets[0]) {
      const newItemId = addMedia({
        type: 'timelapse',
        localPath: result.assets[0].uri,
        duration: result.assets[0].duration ?? undefined,
        timestampInSession: elapsedSeconds,
      });
      if (user?.id && sessionId) {
        const newItem = useSessionStore.getState().media.find(m => m.id === newItemId);
        if (newItem) triggerUpload(newItem, user.id, sessionId);
      }
    }
  };

  const handleAudioToggle = async () => {
    if (isRecordingAudio && recording) {
      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      const durationMs = status.isLoaded ? status.durationMillis ?? 0 : 0;

      if (uri) {
        const newItemId = addMedia({
          type: 'audio',
          localPath: uri,
          duration: Math.round(durationMs / 1000),
          timestampInSession: elapsedSeconds,
        });
        if (user?.id && sessionId) {
          const newItem = useSessionStore.getState().media.find(m => m.id === newItemId);
          if (newItem) triggerUpload(newItem, user.id, sessionId);
        }
      }
      setRecording(null);
      setIsRecordingAudio(false);
    } else {
      // Start recording
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission needed', 'Please allow microphone access to record audio notes.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: rec } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(rec);
        setIsRecordingAudio(true);
      } catch {
        Alert.alert('Error', 'Failed to start audio recording.');
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f0a05' }}>
      <StatusBar barStyle="light-content" />

      {/* Breathing background */}
      <BreathingBackground isPaused={isPaused} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <Text
            style={{
              color: 'rgba(245,237,216,0.7)',
              fontSize: 15,
              fontWeight: '500',
              maxWidth: SCREEN_WIDTH * 0.55,
            }}
            numberOfLines={1}
          >
            {projectName ?? 'Session'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {isPaused && (
              <View
                style={{
                  backgroundColor: 'rgba(192,97,74,0.3)',
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: '#c0614a', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                  PAUSED
                </Text>
              </View>
            )}
            <Text
              style={{
                color: 'rgba(245,237,216,0.4)',
                fontSize: 14,
                fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
                letterSpacing: 1,
              }}
            >
              {formatElapsed(elapsedSeconds)}
            </Text>
          </View>
        </View>

        {/* Paused overlay */}
        {isPaused && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
            }}
          >
            <View
              style={{
                backgroundColor: 'rgba(26,18,7,0.92)',
                borderRadius: 20,
                padding: 32,
                width: SCREEN_WIDTH - 64,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 8 }}>
                SESSION PAUSED
              </Text>
              <Text style={{ color: '#f5edd8', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                {projectName}
              </Text>
              <Text
                style={{
                  color: 'rgba(245,237,216,0.4)',
                  fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
                  fontSize: 18,
                  marginBottom: 28,
                }}
              >
                {formatElapsed(elapsedSeconds)}
              </Text>
              <TouchableOpacity
                onPress={resumeSession}
                style={{
                  backgroundColor: '#d4922a',
                  borderRadius: 14,
                  paddingHorizontal: 32,
                  paddingVertical: 14,
                  marginBottom: 12,
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#1a1207', fontSize: 16, fontWeight: '700' }}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEndSession}
                style={{
                  paddingVertical: 12,
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 15 }}>End & Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main area — spacer */}
        <View style={{ flex: 1 }} />

        {/* End session link */}
        {!isPaused && (
          <TouchableOpacity
            onPress={handleEndSession}
            style={{ alignItems: 'center', paddingBottom: 8 }}
          >
            <Text style={{ color: 'rgba(245,237,216,0.3)', fontSize: 13 }}>
              End Session
            </Text>
          </TouchableOpacity>
        )}

        {/* Media tray */}
        {media.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 72 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
          >
            {media.map((item) => (
              <MediaThumbnail key={item.id} item={item} />
            ))}
          </ScrollView>
        )}

        {/* Capture toolbar */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingTop: 12,
            paddingBottom: 8,
            backgroundColor: 'rgba(15,10,5,0.7)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {/* Note */}
          <TouchableOpacity
            onPress={() => setNoteModalVisible(true)}
            disabled={isPaused}
            style={{ alignItems: 'center', opacity: isPaused ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 3 }}>📝</Text>
            <Text style={{ color: 'rgba(245,237,216,0.55)', fontSize: 11 }}>Note</Text>
          </TouchableOpacity>

          {/* Photo */}
          <TouchableOpacity
            onPress={handlePhoto}
            disabled={isPaused}
            style={{ alignItems: 'center', opacity: isPaused ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 3 }}>📷</Text>
            <Text style={{ color: 'rgba(245,237,216,0.55)', fontSize: 11 }}>Photo</Text>
          </TouchableOpacity>

          {/* Timelapse */}
          <TouchableOpacity
            onPress={handleTimelapse}
            disabled={isPaused}
            style={{ alignItems: 'center', opacity: isPaused ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 3 }}>⏱</Text>
            <Text style={{ color: 'rgba(245,237,216,0.55)', fontSize: 11 }}>TL</Text>
          </TouchableOpacity>

          {/* Video */}
          <TouchableOpacity
            onPress={handleVideo}
            disabled={isPaused}
            style={{ alignItems: 'center', opacity: isPaused ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 3 }}>🎬</Text>
            <Text style={{ color: 'rgba(245,237,216,0.55)', fontSize: 11 }}>Video</Text>
          </TouchableOpacity>

          {/* Audio */}
          <TouchableOpacity
            onPress={handleAudioToggle}
            disabled={isPaused}
            style={{ alignItems: 'center', opacity: isPaused ? 0.4 : 1 }}
          >
            <Text style={{ fontSize: 24, marginBottom: 3 }}>
              {isRecordingAudio ? '⏹' : '🎙'}
            </Text>
            <Text
              style={{
                color: isRecordingAudio ? '#c0614a' : 'rgba(245,237,216,0.55)',
                fontSize: 11,
              }}
            >
              {isRecordingAudio ? 'Stop' : 'Audio'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Text note modal */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              backgroundColor: '#2a1e0e',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 40,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#f5edd8', fontSize: 17, fontWeight: '600' }}>Text note</Text>
              <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What are you noticing?"
              placeholderTextColor="rgba(245,237,216,0.3)"
              multiline
              autoFocus
              style={{
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: '#f5edd8',
                minHeight: 120,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
            />
            <TouchableOpacity
              onPress={handleSaveNote}
              style={{
                backgroundColor: '#d4922a',
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#1a1207', fontWeight: '700', fontSize: 16 }}>
                Save note
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
