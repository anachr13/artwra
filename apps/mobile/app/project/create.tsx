import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '@/lib/api';
import { useProjectStore } from '@/stores/projectStore';
import { Project } from '@/types';

type ProjectStatus = 'in_progress' | 'finalized';

export default function ProjectCreateScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const isEditing = Boolean(projectId);
  const { addProject, updateProject } = useProjectStore();

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const day = now.getDate();
  const defaultTitle = `Untitled — ${monthName} ${day}`;

  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const payload: {
        title?: string;
        discipline: string;
        status: string;
        coverImageUrl?: string;
      } = {
        discipline: discipline.trim() || 'General',
        status,
      };

      if (title.trim()) {
        payload.title = title.trim();
      }

      // In a real implementation, coverImageUri would be uploaded to Supabase Storage first
      // For now, we pass it directly if it's already a remote URL
      if (coverImageUri && coverImageUri.startsWith('http')) {
        payload.coverImageUrl = coverImageUri;
      }

      if (isEditing && projectId) {
        const response = await api.patch<{ data: Project }>(`/projects/${projectId}`, payload);
        updateProject(projectId, response.data.data);
      } else {
        const response = await api.post<{ data: Project }>('/projects', payload);
        addProject(response.data.data);
      }

      router.back();
    } catch {
      setError('Could not save project. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1207' }}>
      <StatusBar barStyle="light-content" />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: 'rgba(245,237,216,0.5)', fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ color: '#f5edd8', fontSize: 17, fontWeight: '600' }}>
          {isEditing ? 'Edit Project' : 'New Project'}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error */}
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

        {/* Project name */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Project name
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={`Give it a name — or we'll call it "${defaultTitle}"`}
            placeholderTextColor="rgba(245,237,216,0.3)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              color: '#f5edd8',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          />
        </View>

        {/* Discipline */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Discipline
          </Text>
          <TextInput
            value={discipline}
            onChangeText={setDiscipline}
            placeholder="e.g. Painting, Sculpture, Photography..."
            placeholderTextColor="rgba(245,237,216,0.3)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              color: '#f5edd8',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          />
        </View>

        {/* Type toggle */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Type
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setStatus('in_progress')}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor:
                  status === 'in_progress'
                    ? 'rgba(212,146,42,0.2)'
                    : 'rgba(255,255,255,0.06)',
                borderWidth: 1.5,
                borderColor:
                  status === 'in_progress' ? '#d4922a' : 'rgba(255,255,255,0.1)',
              }}
            >
              <Text
                style={{
                  color: status === 'in_progress' ? '#d4922a' : 'rgba(245,237,216,0.6)',
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                In Progress
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStatus('finalized')}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor:
                  status === 'finalized'
                    ? 'rgba(74,111,165,0.2)'
                    : 'rgba(255,255,255,0.06)',
                borderWidth: 1.5,
                borderColor:
                  status === 'finalized' ? '#4a6fa5' : 'rgba(255,255,255,0.1)',
              }}
            >
              <Text
                style={{
                  color: status === 'finalized' ? '#7ab0d4' : 'rgba(245,237,216,0.6)',
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                Finished
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cover image */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 13, color: 'rgba(245,237,216,0.6)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cover image
          </Text>

          <TouchableOpacity
            onPress={handlePickCover}
            style={{
              height: 180,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.1)',
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
            activeOpacity={0.8}
          >
            {coverImageUri ? (
              <Image
                source={{ uri: coverImageUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>🖼</Text>
                <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 14 }}>
                  Add a cover
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? 'rgba(212,146,42,0.5)' : '#d4922a',
            borderRadius: 16,
            padding: 16,
            alignItems: 'center',
          }}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#1a1207" />
          ) : (
            <Text style={{ color: '#1a1207', fontSize: 17, fontWeight: '700' }}>
              {isEditing ? 'Save changes' : 'Create project'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
