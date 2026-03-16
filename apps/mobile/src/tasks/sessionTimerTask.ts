import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

export const TIMER_TASK_NAME = 'ARTWRA_SESSION_TIMER';

TaskManager.defineTask(TIMER_TASK_NAME, async () => {
  const { useSessionStore } = require('../stores/sessionStore');
  const store = useSessionStore.getState() as {
    isDraft: boolean;
    startedAt: string | null;
    isPaused: boolean;
    tickTimer: () => void;
  };

  if (store.isDraft && store.startedAt && !store.isPaused) {
    store.tickTimer();
  }

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

export async function registerTimerTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TIMER_TASK_NAME);
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(TIMER_TASK_NAME, {
      minimumInterval: 1,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}

export async function unregisterTimerTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TIMER_TASK_NAME);
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(TIMER_TASK_NAME);
  }
}
