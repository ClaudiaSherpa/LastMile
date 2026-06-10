import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Lazily connect a single shared socket and join the given room. */
export function useRoom(room: string) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!socket) socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    const s = socket;
    const join = () => { setConnected(true); s.emit('join', { room }); };
    if (s.connected) join();
    s.on('connect', join);
    s.on('disconnect', () => setConnected(false));
    return () => { s.off('connect', join); };
  }, [room]);
  return { socket, connected };
}

/** Subscribe to a server event while mounted. */
export function useEvent(event: string, handler: (payload: any) => void) {
  useEffect(() => {
    if (!socket) socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    const s = socket;
    s.on(event, handler);
    return () => { s.off(event, handler); };
  }, [event, handler]);
}
