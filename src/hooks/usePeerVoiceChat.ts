import { useState, useEffect, useRef, useCallback } from 'react';
import { externalSupabase } from '@/lib/external-supabase';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface VoiceSignal {
  id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string | null;
  signal_type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  signal_data: any;
  created_at: string;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function usePeerVoiceChat(roomId: string | null, userId: string | null) {
  const { toast } = useToast();
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Create peer connection for a specific user
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`Creating peer connection for ${peerId}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming tracks (remote audio)
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      const [remoteStream] = event.streams;
      
      // Create or update audio element for this peer
      let audioEl = audioElementsRef.current.get(peerId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioElementsRef.current.set(peerId, audioEl);
      }
      audioEl.srcObject = remoteStream;
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate && roomId && userId) {
        console.log(`Sending ICE candidate to ${peerId}`);
        await externalSupabase.from('peer_voice_signals').insert([{
          room_id: roomId,
          from_user_id: userId,
          to_user_id: peerId,
          signal_type: 'ice-candidate',
          signal_data: event.candidate.toJSON() as unknown as Json,
        }]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setConnectedPeers(prev => [...new Set([...prev, peerId])]);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectedPeers(prev => prev.filter(id => id !== peerId));
      }
    };

    peerConnectionsRef.current.set(peerId, { peerId, connection: pc });
    return pc;
  }, [roomId, userId]);

  // Handle incoming signals
  const handleSignal = useCallback(async (signal: VoiceSignal) => {
    if (!userId || signal.from_user_id === userId) return;

    const peerId = signal.from_user_id;
    console.log(`Received signal: ${signal.signal_type} from ${peerId}`);

    if (signal.signal_type === 'join') {
      // New peer joined, create offer
      if (isVoiceEnabled && localStreamRef.current) {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        await externalSupabase.from('peer_voice_signals').insert([{
          room_id: roomId,
          from_user_id: userId,
          to_user_id: peerId,
          signal_type: 'offer',
          signal_data: { sdp: offer.sdp, type: offer.type } as unknown as Json,
        }]);
      }
    } else if (signal.signal_type === 'offer') {
      // Received offer, create answer
      let peerData = peerConnectionsRef.current.get(peerId);
      if (!peerData) {
        createPeerConnection(peerId);
        peerData = peerConnectionsRef.current.get(peerId);
      }
      
      if (peerData) {
        await peerData.connection.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
        const answer = await peerData.connection.createAnswer();
        await peerData.connection.setLocalDescription(answer);
        
        await externalSupabase.from('peer_voice_signals').insert([{
          room_id: roomId,
          from_user_id: userId,
          to_user_id: peerId,
          signal_type: 'answer',
          signal_data: { sdp: answer.sdp, type: answer.type } as unknown as Json,
        }]);
      }
    } else if (signal.signal_type === 'answer') {
      // Received answer
      const peerData = peerConnectionsRef.current.get(peerId);
      if (peerData && peerData.connection.signalingState !== 'stable') {
        await peerData.connection.setRemoteDescription(new RTCSessionDescription(signal.signal_data));
      }
    } else if (signal.signal_type === 'ice-candidate') {
      // Received ICE candidate
      const peerData = peerConnectionsRef.current.get(peerId);
      if (peerData) {
        try {
          await peerData.connection.addIceCandidate(new RTCIceCandidate(signal.signal_data));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    } else if (signal.signal_type === 'leave') {
      // Peer left
      const peerData = peerConnectionsRef.current.get(peerId);
      if (peerData) {
        peerData.connection.close();
        peerConnectionsRef.current.delete(peerId);
        audioElementsRef.current.get(peerId)?.remove();
        audioElementsRef.current.delete(peerId);
        setConnectedPeers(prev => prev.filter(id => id !== peerId));
      }
    }
  }, [userId, roomId, isVoiceEnabled, createPeerConnection]);

  // Subscribe to signals
  useEffect(() => {
    if (!roomId || !userId || !isVoiceEnabled) return;

    console.log('Subscribing to voice signals for room:', roomId);

    const channel = externalSupabase
      .channel(`voice-signals-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'peer_voice_signals',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const signal = payload.new as VoiceSignal;
          // Only process signals directed to us or broadcast
          if (signal.to_user_id === null || signal.to_user_id === userId) {
            handleSignal(signal);
          }
        }
      )
      .subscribe();

    return () => {
      externalSupabase.removeChannel(channel);
    };
  }, [roomId, userId, isVoiceEnabled, handleSignal]);

  // Start voice chat
  const startVoiceChat = useCallback(async () => {
    if (!roomId || !userId) return;

    setIsConnecting(true);
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      setIsVoiceEnabled(true);

      // Announce our presence
      await externalSupabase.from('peer_voice_signals').insert([{
        room_id: roomId,
        from_user_id: userId,
        to_user_id: null,
        signal_type: 'join',
        signal_data: { timestamp: Date.now() } as unknown as Json,
      }]);

      toast({
        title: 'Voice Chat Enabled',
        description: 'You can now talk with other participants.',
      });
    } catch (error) {
      console.error('Error starting voice chat:', error);
      toast({
        title: 'Microphone Access Required',
        description: 'Please enable microphone access to use voice chat.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [roomId, userId, toast]);

  // Stop voice chat
  const stopVoiceChat = useCallback(async () => {
    if (!roomId || !userId) return;

    // Announce leaving
    await externalSupabase.from('peer_voice_signals').insert({
      room_id: roomId,
      from_user_id: userId,
      to_user_id: null,
      signal_type: 'leave',
      signal_data: { timestamp: Date.now() },
    });

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();

    // Stop local stream
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;

    // Remove audio elements
    audioElementsRef.current.forEach(el => el.remove());
    audioElementsRef.current.clear();

    setIsVoiceEnabled(false);
    setConnectedPeers([]);

    toast({
      title: 'Voice Chat Disabled',
      description: 'You have left the voice chat.',
    });
  }, [roomId, userId, toast]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach(({ connection }) => {
        connection.close();
      });
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      audioElementsRef.current.forEach(el => el.remove());
    };
  }, []);

  return {
    isVoiceEnabled,
    isMuted,
    isConnecting,
    connectedPeers,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
  };
}