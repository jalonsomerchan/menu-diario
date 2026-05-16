type Task = () => Promise<void> | void;

type DebouncedTaskMapOptions = {
  delay: number;
  onError?: (error: unknown) => void;
};

export function createDebouncedTaskMap(options: DebouncedTaskMapOptions) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const tasks = new Map<string, Task>();

  async function run(key: string) {
    const task = tasks.get(key);
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.delete(key);
    tasks.delete(key);
    if (!task) return;

    try {
      await task();
    } catch (error) {
      options.onError?.(error);
    }
  }

  return {
    schedule(key: string, task: Task) {
      tasks.set(key, task);
      const currentTimer = timers.get(key);
      if (currentTimer) clearTimeout(currentTimer);
      timers.set(
        key,
        setTimeout(() => {
          void run(key);
        }, options.delay)
      );
    },
    flush(key: string) {
      return run(key);
    },
    cancel(key: string) {
      const timer = timers.get(key);
      if (timer) clearTimeout(timer);
      timers.delete(key);
      tasks.delete(key);
    },
    cancelAll() {
      [...timers.keys()].forEach((key) => {
        const timer = timers.get(key);
        if (timer) clearTimeout(timer);
      });
      timers.clear();
      tasks.clear();
    },
  };
}
