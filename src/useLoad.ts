import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

/** Run an async loader every time the screen gains focus. */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | null; reload: () => void; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      loader()
        .then((d) => alive && setData(d))
        .catch((e) => console.warn('load failed', e))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tick, ...deps]),
  );
  return { data, loading, reload: () => setTick((t) => t + 1) };
}
