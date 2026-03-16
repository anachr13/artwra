import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  RefreshControl,
  Dimensions,
  PanResponder,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useProjectStore } from '@/stores/projectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { formatRelative } from '@/lib/formatters';
import { Project } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

function ProjectCard({ project }: { project: Project }) {
  const statusConfig = {
    in_progress: { label: 'In Progress', bg: 'rgba(212,146,42,0.2)', text: '#d4922a' },
    finalized: { label: 'Finished', bg: 'rgba(74,111,165,0.2)', text: '#7ab0d4' },
    private: { label: 'Private', bg: 'rgba(255,255,255,0.1)', text: 'rgba(245,237,216,0.5)' },
  };

  const status = statusConfig[project.status];

  return (
    <TouchableOpacity
      onPress={() => router.push(`/session/start?projectId=${project.id}`)}
      style={{
        width: CARD_WIDTH,
        marginBottom: 16,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#2a1e0e',
      }}
      activeOpacity={0.85}
    >
      {/* Cover image */}
      <View style={{ aspectRatio: 4 / 3, backgroundColor: '#3d2c14' }}>
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
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#3d2c14',
            }}
          >
            <Text style={{ fontSize: 32, opacity: 0.3 }}>🎨</Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={{ padding: 10 }}>
        <Text
          style={{ color: '#f5edd8', fontSize: 14, fontWeight: '600', marginBottom: 6 }}
          numberOfLines={2}
        >
          {project.title}
        </Text>

        {/* Status pill */}
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: status.bg,
            borderRadius: 20,
            paddingHorizontal: 8,
            paddingVertical: 3,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: status.text, fontSize: 11, fontWeight: '600' }}>
            {status.label}
          </Text>
        </View>

        {project.lastSessionAt && (
          <Text style={{ color: 'rgba(245,237,216,0.4)', fontSize: 11 }}>
            {formatRelative(project.lastSessionAt)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function PausedBanner({
  projectName,
  onResume,
  onDismiss,
}: {
  projectName: string;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy < -40) {
          Animated.timing(translateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ translateY }] }}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: '#2a1e0e',
          borderRadius: 14,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(212,146,42,0.3)',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#d4922a', fontSize: 12, fontWeight: '600', marginBottom: 2 }}>
            PAUSED SESSION
          </Text>
          <Text style={{ color: '#f5edd8', fontSize: 14 }} numberOfLines={1}>
            {projectName}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onResume}
          style={{
            backgroundColor: '#d4922a',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#1a1207', fontWeight: '700', fontSize: 14 }}>
            Resume
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default function GalleryScreen() {
  const { projects, isLoading, error, fetchProjects } = useProjectStore();
  const { isDraft, projectName } = useSessionStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showBanner = isDraft && projectName && !bannerDismissed;

  useEffect(() => {
    fetchProjects();
    setBannerDismissed(false);
  }, [fetchProjects]);

  const handleResume = () => {
    router.push('/session/active');
  };

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1207' }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#f5edd8', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
            Couldn't load your projects
          </Text>
          <TouchableOpacity
            onPress={fetchProjects}
            style={{ backgroundColor: '#d4922a', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: '#1a1207', fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!isLoading && projects.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1207' }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 40, fontWeight: '700', color: '#d4922a', letterSpacing: 1, marginBottom: 12 }}>
            Artwra
          </Text>
          <Text style={{ fontSize: 17, color: 'rgba(245,237,216,0.55)', textAlign: 'center', marginBottom: 52 }}>
            Your creative work lives here
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/project/create')}
            style={{
              backgroundColor: '#d4922a',
              borderRadius: 16,
              paddingHorizontal: 40,
              paddingVertical: 18,
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#1a1207', fontSize: 18, fontWeight: '700' }}>
              Add Art
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1207' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#d4922a', letterSpacing: 0.5 }}>
          Artwra
        </Text>
      </View>

      {/* Paused session banner */}
      {showBanner && (
        <PausedBanner
          projectName={projectName!}
          onResume={handleResume}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Projects grid */}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchProjects}
            tintColor="#d4922a"
          />
        }
        renderItem={({ item }) => <ProjectCard project={item} />}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/project/create')}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#d4922a',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#d4922a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#1a1207', fontSize: 28, fontWeight: '300', lineHeight: 32 }}>
          +
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
