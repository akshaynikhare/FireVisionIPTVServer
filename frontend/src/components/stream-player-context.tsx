'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  lazy,
  Suspense,
  type ReactNode,
} from 'react';

const StreamPlayer = lazy(() => import('./stream-player'));

interface StreamChannel {
  name: string;
  url: string;
  logo?: string;
  channelId?: string;
}

interface StreamPlayerState {
  channel: StreamChannel | null;
  mode: 'proxy' | 'direct-fallback';
}

interface StreamPlayerContextValue {
  /** Start playing a stream. Persists across page navigations until closed. */
  playStream: (channel: StreamChannel, options?: { mode?: 'proxy' | 'direct-fallback' }) => void;
  /** Close the stream player. */
  closeStream: () => void;
  /** Whether a stream is currently active. */
  isPlaying: boolean;
}

const StreamPlayerContext = createContext<StreamPlayerContextValue | null>(null);

export function useStreamPlayer() {
  const ctx = useContext(StreamPlayerContext);
  if (!ctx) throw new Error('useStreamPlayer must be used within StreamPlayerProvider');
  return ctx;
}

export function StreamPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StreamPlayerState>({
    channel: null,
    mode: 'proxy',
  });

  const playStream = useCallback(
    (channel: StreamChannel, options?: { mode?: 'proxy' | 'direct-fallback' }) => {
      setState({
        channel,
        mode: options?.mode ?? 'proxy',
      });
    },
    [],
  );

  const closeStream = useCallback(() => {
    setState({ channel: null, mode: 'proxy' });
  }, []);

  return (
    <StreamPlayerContext.Provider value={{ playStream, closeStream, isPlaying: !!state.channel }}>
      {children}
      {state.channel && (
        <Suspense fallback={null}>
          <StreamPlayer channel={state.channel} onClose={closeStream} mode={state.mode} />
        </Suspense>
      )}
    </StreamPlayerContext.Provider>
  );
}
