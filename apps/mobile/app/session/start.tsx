import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import api from '@/lib/api';
import { useProjectStore } from '@/stores/projectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { Project, CaptureMode } from '@/types';

export default function SessionStartScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { projects } = useProjectStore();
  const { startSession } = useSessionStore();

  const [project, setProject] = useState<Project | null>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('free_capture');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      const found = projects.find((p) => p.id === projectId);
      if (found) {
        setProject(found);
      } else {
        // Fetch from API if not in store
        api
          .get<{ data: Project }>(`/projects/${projectId}`)
          .then((r) => setProject(r.data.data))
          .catch(() => setError('Could not load project.'));
      }
    }
  }, [projectId, projects]);

  const handleBeginSession = async () => {
    if (!project) return;
    setIsLoading(true);
    setError(null);

    try {
      const startedAt = new Date().toISOString();
      const response = await api.post<{ data: { id: string } }>('/sessions', {
        projectId: project.id,
        captureMode,
        startedAt,
      });

      const sessionId = response.data.data.id;
      startSession(project.id, project.title, captureMode, sessionId);

      router.replace('/session/active');
    } catch {
      setError('Could not start session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1207', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#d4922a" />
      </SafeAreaView>
    );
  }

  const statusLabel =
    project.status === 'in_progress'
      ? 'In Progress'
      : project.status === 'finalized'
      ? 'Finished'
      : 'Private';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1207' }}>
      <StatusBar barStyle="light-content" />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: 56, left: 16, zIndex: 10, padding: 8 }}
      >
        <Text style={{ color: 'rgba(245,237,216,0.6)', fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Project header */}
        <View style={{ height: 220, backgroundColor: '#3d2c14', position: 'relative' }}>
          {project.coverImageUrl ? (
            <Image
              source={{ uri: project.coverImageUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: '#3d2c14',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 48, opacity: 0.3 }}>🎨</Text>
            </View>
          )}

          {/* Dimming overlay */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(15,10,5,0.55)',
            }}
          />

          {/* Project info overlay */}
          <View
            style={{
              position: 'absolute',
              bottom: 20,
              left: 20,
              right: 20,
            }}
          >
            <Text style={{ color: '#f5edd8', fontSize: 22, fontWeight: '700' }}>
              {project.title}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(212,146,42,0.25)',
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                marginTop: 6,
              }}
            >
              <Text style={{ color: '#d4922a', fontSize: 12, fontWeight: '600' }}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Capture mode selector */}
        <View style={{ padding: 24 }}>
          <Text
            style={{
              color: 'rgba(245,237,216,0.7)',
              fontSize: 15,
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            How do you want to capture today?
          </Text>

          {/* Free capture card */}
          <TouchableOpacity
            onPress={() => setCaptureMode('free_capture')}
            style={{
              backgroundColor:
                captureMode === 'free_capture'
                  ? 'rgba(212,146,42,0.15)'
                  : 'rgba(255,255,255,0.05)',
              borderRadius: 14,
              padding: 18,
              marginBottom: 12,
              borderWidth: 1.5,
              borderColor:
                captureMode === 'free_capture'
                  ? '#d4922a'
                  : 'rgba(255,255,255,0.1)',
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>✦</Text>
              <Text
                style={{
                  color: captureMode === 'free_capture' ? '#d4922a' : '#f5edd8',
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Free capture
              </Text>
            </View>
            <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 13, lineHeight: 18 }}>
              I'll capture in the moment — use any tool whenever you like
            </Text>
          </TouchableOpacity>

          {/* Time-lapse card */}
          <TouchableOpacity
            onPress={() => setCaptureMode('timelapse')}
            style={{
              backgroundColor:
                captureMode === 'timelapse'
                  ? 'rgba(74,111,165,0.15)'
                  : 'rgba(255,255,255,0.05)',
              borderRadius: 14,
              padding: 18,
              marginBottom: 32,
              borderWidth: 1.5,
              borderColor:
                captureMode === 'timelapse'
                  ? '#4a6fa5'
                  : 'rgba(255,255,255,0.1)',
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>⏱</Text>
              <Text
                style={{
                  color: captureMode === 'timelapse' ? '#7ab0d4' : '#f5edd8',
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Time-lapse
              </Text>
            </View>
            <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 13, lineHeight: 18 }}>
              Record my workspace over time — the time-lapse tool will be prominently surfaced
            </Text>
          </TouchableOpacity>

          {/* Error message */}
          {error && (
            <View
              style={{
                backgroundColor: 'rgba(192,97,74,0.15)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(192,97,74,0.4)',
              }}
            >
              <Text style={{ color: '#c0614a', fontSize: 14 }}>{error}</Text>
            </View>
          )}

          {/* Begin session button */}
          <TouchableOpacity
            onPress={handleBeginSession}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? 'rgba(212,146,42,0.5)' : '#d4922a',
              borderRadius: 16,
              padding: 18,
              alignItems: 'center',
              marginBottom: 20,
            }}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#1a1207" />
            ) : (
              <Text style={{ color: '#1a1207', fontSize: 18, fontWeight: '700' }}>
                Begin Session
              </Text>
            )}
          </TouchableOpacity>

          {/* New project link */}
          <TouchableOpacity
            onPress={() => router.push('/project/create')}
            style={{ alignItems: 'center' }}
          >
            <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 14 }}>
              Start a new project instead
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

