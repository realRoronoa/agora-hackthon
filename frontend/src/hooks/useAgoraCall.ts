import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

AgoraRTC.setLogLevel(3); // Warnings and errors only

export interface AgoraCallOptions {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  incidentId?: string;
  isDemoMode?: boolean;
  enableRtm?: boolean;
  rtmToken?: string | null;
}

export interface TranscriptLine {
  sender: "agent" | "user";
  text: string;
  time: string;
}

export function useAgoraCall() {
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const timerRef = useRef<any>(null);
  const demoIntervalRef = useRef<any>(null);
  const activeIncidentIdRef = useRef<string | null>(null);
  const inCallRef = useRef<boolean>(false);

  // Keep inCallRef in sync
  useEffect(() => {
    inCallRef.current = inCall;
  }, [inCall]);

  // Clean shutdown on browser tab close to prevent orphan Agora agents (20-PCU limit protection)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (inCallRef.current && activeIncidentIdRef.current) {
        const apiBase = import.meta.env.VITE_API_URL || "";
        const stopUrl = `${apiBase}/api/calls/stop`;
        const payload = JSON.stringify({ incident_id: activeIncidentIdRef.current });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: "application/json" });
          navigator.sendBeacon(stopUrl, blob);
        } else {
          fetch(stopUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (timerRef.current) clearInterval(timerRef.current);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);

  const startTimer = () => {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCallDuration(0);
  };

  const joinCall = useCallback(async (options: AgoraCallOptions) => {
    const { appId, channel, token, uid, incidentId, isDemoMode, enableRtm } = options;
    activeIncidentIdRef.current = incidentId || null;

    // Default opening agent transcript
    setTranscripts([
      {
        sender: "agent",
        text: "Alert. NightWatch here. Production checkout just crashed after the latest deployment. Do I have full permission to roll back to v1.4.2, or only limited permission to restart the worker and log a hotfix issue?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);

    // Demo Mode handling or placeholder Agora keys
    if (isDemoMode || !appId || appId === "demo-app-id" || appId.length < 10) {
      setInCall(true);
      startTimer();
      demoIntervalRef.current = setInterval(() => {
        const rand = Math.floor(Math.random() * 60) + 20;
        setRemoteAudioLevel(rand);
        setAgentSpeaking(rand > 30);
      }, 350);
      return;
    }

    try {
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Volume indicator for real-time waveform
      client.enableAudioVolumeIndicator();

      client.on("volume-indicator", (volumes) => {
        volumes.forEach((vol) => {
          if (vol.uid === uid) {
            setLocalAudioLevel(vol.level);
          } else {
            setRemoteAudioLevel(vol.level);
            setAgentSpeaking(vol.level > 10);
          }
        });
      });

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      // Join RTC channel
      await client.join(appId, channel, token || null, uid);

      // Create and publish local microphone track
      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "high_quality_stereo",
        AEC: true,
        ANS: true,
      });
      localTrackRef.current = micTrack;
      await client.publish(micTrack);

      // Optional RTM transcript listener (Safely isolated so RTM errors never block audio)
      if (enableRtm) {
        try {
          // Listen on data-stream / custom message events if supported by RTC channel
          client.on("stream-message", (_uid: any, stream: any) => {
            try {
              const text = new TextDecoder().decode(stream);
              const parsed = JSON.parse(text);
              if (parsed.text) {
                setTranscripts((prev) => [
                  ...prev,
                  {
                    sender: parsed.sender === "agent" ? "agent" : "user",
                    text: parsed.text,
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                  },
                ]);
              }
            } catch (err) {
              console.warn("RTM data parse warning:", err);
            }
          });
        } catch (rtmErr) {
          console.warn("RTM setup skipped (audio stream unaffected):", rtmErr);
        }
      }

      setInCall(true);
      startTimer();
    } catch (err) {
      console.warn("Agora RTC live join warning (falling back to simulated channel):", err);
      setInCall(true);
      startTimer();
    }
  }, []);

  const leaveCall = useCallback(async () => {
    stopTimer();
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    try {
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current.close();
        localTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch (e) {
      console.error("Error leaving Agora call", e);
    } finally {
      setInCall(false);
      setIsMuted(false);
      setRemoteAudioLevel(0);
      setLocalAudioLevel(0);
      setAgentSpeaking(false);
      activeIncidentIdRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (localTrackRef.current) {
      const nextMuted = !isMuted;
      localTrackRef.current.setEnabled(!nextMuted);
      setIsMuted(nextMuted);
    } else {
      setIsMuted((prev) => !prev);
    }
  }, [isMuted]);

  const addManualTranscript = useCallback((sender: "agent" | "user", text: string) => {
    setTranscripts((prev) => [
      ...prev,
      {
        sender,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
    ]);
  }, []);

  return {
    inCall,
    isMuted,
    remoteAudioLevel,
    localAudioLevel,
    agentSpeaking,
    callDuration,
    transcripts,
    joinCall,
    leaveCall,
    toggleMute,
    addManualTranscript,
  };
}
