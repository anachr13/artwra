import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import api from '@/lib/api';
import { useSessionStore, MediaItem } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { formatElapsed, formatDuration } from '@/lib/formatters';
import { uploadAllPending } from '@/services/uploadService';

function SummaryStrip({ elapsedSeconds, media }: { elapsedSeconds: number; media: MediaItem[] }) {
  const photoCount = media.filter((m) => m.type === 'photo').length;
  const videoCount = media.filter((m) => m.type === 'video').length;
  const timelapseCount = media.filter((m) => m.type === 'timelapse').length;
  const audioCount = media.filter((m) => m.type === 'audio').length;
  const textCount = media.filter((m) => m.type === 'text_note').length;

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <StatItem icon="⏱" value={formatDuration(elapsedSeconds)} label="Duration" />
      {photoCount > 0 && <StatItem icon="📷" value={String(photoCount)} label="Photos" />}
      {videoCount > 0 && <StatItem icon="🎬" value={String(videoCount)} label="Clips" />}
      {timelapseCount > 0 && <StatItem icon="⏱" value={String(timelapseCount)} label="TL" />}
      {audioCount > 0 && <StatItem icon="🎙" value={String(audioCount)} label="Audio" />}
      {textCount > 0 && <StatItem icon="📝" value={String(textCount)} label="Notes" />}
    </View>
  );
}

function StatItem({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 52 }}>
      <Text style={{ fontSize: 18, marginBottom: 2 }}>{icon}</Text>
      <Text style={{ color: '#f5edd8', fontSize: 16, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function MediaVisibilityToggle({
  isPublic,
  onToggle,
}: {
  isPublic: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity onPress={onToggle} style={{ padding: 4 }}>
      <Text style={{ fontSize: 18 }}>{isPublic ? '👁' : '🔒'}</Text>
    </TouchableOpacity>
  );
}

export default function CheckoutScreen() {
  const {
    sessionId,
    projectId,
    elapsedSeconds,
    media,
    reflectionNote,
    setReflectionNote,
    updateMediaVisibility,
    updateTextNote,
    removeMedia,
    addMedia,
    clearSession,
    discardSession,
  } = useSessionStore();

  const { user } = useAuthStore();
  const { fetchProjects } = useProjectStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const photos = media.filter((m) => m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');
  const timelapses = media.filter((m) => m.type === 'timelapse');
  const audios = media.filter((m) => m.type === 'audio');
  const textNotes = media.filter((m) => m.type === 'text_note');

  const handleSave = async () => {
    if (!sessionId) return;

    // Sync any pending media uploads first
    const hasPending = media.some(m => m.syncStatus === 'pending' || m.syncStatus === 'failed');
    if (hasPending && user?.id) {
      setIsSyncing(true);
      try {
        await uploadAllPending(user.id, sessionId);
      } finally {
        setIsSyncing(false);
      }
    }

    setIsSaving(true);

    try {
      const endedAt = new Date().toISOString();
      const durationSec = elapsedSeconds;

      await api.patch(`/sessions/${sessionId}`, {
        endedAt,
        durationSec,
        reflectionNote: reflectionNote || undefined,
        isDraft: false,
      });

      // Update project stats in store
      if (projectId) {
        await fetchProjects();
      }

      clearSession();
      router.replace('/(tabs)/gallery');
    } catch {
      Alert.alert(
        'Save failed',
        "Couldn't save session — your work is stored locally. Tap to retry.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleSave },
        ]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard session?',
      'This will permanently delete everything captured in this session. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, discard',
          style: 'destructive',
          onPress: async () => {
            await discardSession();
            router.replace('/(tabs)/gallery');
          },
        },
      ]
    );
  };

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
    });

    if (!result.canceled) {
      result.assets.forEach((asset) => {
        addMedia({
          type: 'photo',
          localPath: asset.uri,
          timestampInSession: elapsedSeconds,
          postSession: true,
        });
      });
    }
  };

  const handleAddAudio = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow microphone access.');
        return;
      }
      Alert.alert('Audio', 'Audio recording available during active session only.');
    } catch {
      Alert.alert('Error', 'Could not access microphone.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1a1207', '#2a1e0e', '#1a1207']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <Text style={{ color: '#d4922a', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: 4 }}>
            SESSION COMPLETE
          </Text>
          <Text style={{ color: '#f5edd8', fontSize: 22, fontWeight: '700' }}>
            Review your session
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        >
          {/* Summary strip */}
          <SummaryStrip elapsedSeconds={elapsedSeconds} media={media} />

          {/* Photos */}
          {photos.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 }}>
                PHOTOS
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {photos.map((item) => (
                  <View key={item.id} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: item.localPath }}
                      style={{ width: 100, height: 100, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                      }}
                    >
                      <MediaVisibilityToggle
                        isPublic={item.isPublic}
                        onToggle={() => updateMediaVisibility(item.id, !item.isPublic)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Videos */}
          {videos.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 }}>
                VIDEO CLIPS
              </Text>
              {videos.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>🎬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f5edd8', fontSize: 14 }}>
                      {item.duration ? formatDuration(item.duration) : 'Video clip'}
                    </Text>
                    <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 12 }}>
                      at {formatElapsed(item.timestampInSession)}
                    </Text>
                  </View>
                  <MediaVisibilityToggle
                    isPublic={item.isPublic}
                    onToggle={() => updateMediaVisibility(item.id, !item.isPublic)}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Timelapses */}
          {timelapses.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 }}>
                TIME-LAPSE CLIPS
              </Text>
              {timelapses.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: 'rgba(74,111,165,0.1)',
                    borderRadius: 12,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(74,111,165,0.25)',
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>⏱</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#f5edd8', fontSize: 14 }}>
                        {item.duration ? formatDuration(item.duration) : 'Time-lapse'}
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#4a6fa5',
                          borderRadius: 4,
                          paddingHorizontal: 5,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>TL</Text>
                      </View>
                    </View>
                    <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 12 }}>
                      at {formatElapsed(item.timestampInSession)}
                    </Text>
                  </View>
                  <MediaVisibilityToggle
                    isPublic={item.isPublic}
                    onToggle={() => updateMediaVisibility(item.id, !item.isPublic)}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Audio notes */}
          {audios.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 }}>
                AUDIO NOTES
              </Text>
              {audios.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>🎙</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f5edd8', fontSize: 14 }}>
                      {item.duration ? formatDuration(item.duration) : 'Audio note'}
                    </Text>
                    <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 12 }}>
                      at {formatElapsed(item.timestampInSession)}
                    </Text>
                  </View>
                  <MediaVisibilityToggle
                    isPublic={item.isPublic}
                    onToggle={() => updateMediaVisibility(item.id, !item.isPublic)}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Session notes (text notes) */}
          {textNotes.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 }}>
                SESSION NOTES
              </Text>
              {textNotes.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  {editingNoteId === item.id ? (
                    <TextInput
                      value={item.content ?? ''}
                      onChangeText={(text) => updateTextNote(item.id, text)}
                      onBlur={() => setEditingNoteId(null)}
                      multiline
                      autoFocus
                      style={{
                        color: '#f5edd8',
                        fontSize: 14,
                        lineHeight: 20,
                        minHeight: 60,
                      }}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => setEditingNoteId(item.id)}>
                      <Text style={{ color: '#f5edd8', fontSize: 14, lineHeight: 20 }}>
                        {item.content}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: 'rgba(245,237,216,0.3)', fontSize: 11 }}>
                      at {formatElapsed(item.timestampInSession)}
                    </Text>
                    <TouchableOpacity onPress={() => removeMedia(item.id)}>
                      <Text style={{ color: 'rgba(192,97,74,0.7)', fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add more */}
          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 14, marginBottom: 12 }}>
              Anything you want to add?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleAddPhoto}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📷</Text>
                <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 12 }}>+ Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddAudio}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>🎙</Text>
                <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 12 }}>+ Audio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  addMedia({
                    type: 'text_note',
                    content: '',
                    timestampInSession: elapsedSeconds,
                    postSession: true,
                  });
                }}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>📝</Text>
                <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 12 }}>+ Note</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reflection note */}
          <View
            style={{
              backgroundColor: 'rgba(212,146,42,0.07)',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(212,146,42,0.2)',
              marginBottom: 24,
            }}
          >
            <Text style={{ color: '#d4922a', fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
              How did this session feel?
            </Text>
            <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 12, marginBottom: 12 }}>
              Optional — just for you
            </Text>
            <TextInput
              value={reflectionNote}
              onChangeText={setReflectionNote}
              placeholder="Write anything — what worked, what didn't, where you want to go next..."
              placeholderTextColor="rgba(245,237,216,0.25)"
              multiline
              style={{
                color: '#f5edd8',
                fontSize: 15,
                lineHeight: 22,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            paddingBottom: 36,
            backgroundColor: 'rgba(26,18,7,0.95)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving || isSyncing}
            style={{
              backgroundColor: (isSaving || isSyncing) ? 'rgba(212,146,42,0.5)' : '#d4922a',
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {isSyncing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#1a1207" />
                <Text style={{ color: '#1a1207', fontSize: 17, fontWeight: '700' }}>
                  Syncing your media...
                </Text>
              </View>
            ) : isSaving ? (
              <ActivityIndicator color="#1a1207" />
            ) : (
              <Text style={{ color: '#1a1207', fontSize: 17, fontWeight: '700' }}>
                Save Session
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDiscard} style={{ alignItems: 'center' }}>
            <Text style={{ color: 'rgba(245,237,216,0.35)', fontSize: 15 }}>
              Discard Session
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
