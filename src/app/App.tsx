"use client";
// Import browser shims first to fix OpenAI agents compatibility
import "@/app/lib/browserShims";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from "@openai/agents/realtime";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { customerServiceRetailScenario } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorScenario } from "@/app/agentConfigs/chatSupervisor";
import { customerServiceRetailCompanyName } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";
import { simpleHandoffScenario } from "@/app/agentConfigs/simpleHandoff";
import atchaltaAgents from "@/app/agentConfigs/atchalta";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
  atchalta: atchaltaAgents,
};

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";

function App() {
  const searchParams = useSearchParams()!;

  // ---------------------------------------------------------------------
  // Codec selector – lets you toggle between wide-band Opus (48 kHz)
  // and narrow-band PCMU/PCMA (8 kHz) to hear what the agent sounds like on
  // a traditional phone line and to validate ASR / VAD behaviour under that
  // constraint.
  //
  // We read the `?codec=` query-param and rely on the `changePeerConnection`
  // hook (configured in `useRealtimeSession`) to set the preferred codec
  // before the offer/answer negotiation.
  // ---------------------------------------------------------------------
  const urlCodec = searchParams.get("codec") || "opus";

  // Agents SDK doesn't currently support codec selection so it is now forced
  // via global codecPatch at module load

  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const el = document.createElement("audio");
    el.autoplay = true;
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  }, []);

  // File upload (Sensemaker map screenshot)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleUploadButtonClick = () => {
    console.log(
      "Upload button clicked, sessionStatus:",
      sessionStatus,
      "WebRTC ready:",
      isWebRTCReady()
    );
    // Gate upload on connection status AND WebRTC readiness
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot upload map: session not ready");
      addTranscriptBreadcrumb("Upload blocked: Connection not ready");
      return;
    }
    console.log("Triggering file input click");
    fileInputRef.current?.click();
  };
  const handleMapFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File selected event triggered");
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }
    console.log("File selected:", file.name, file.type, file.size);

    // Double-check connection status AND WebRTC readiness when file is selected
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot process map upload: session not ready");
      addTranscriptBreadcrumb("Upload failed: Connection not ready");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      console.warn("Invalid file type:", file.type);
      addTranscriptBreadcrumb("Upload failed: Invalid file type");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addTranscriptBreadcrumb("Map uploaded", {
        name: file.name,
        size: file.size,
      });

      const analysisAsk = `Please analyze this Sensemaker map screenshot using the Atchalta Field Guide. Call sensemaker_vision_read with image_url="${dataUrl}". Then summarize nodes, clusters, connections and 2–3 insights, grounding in [Field Guide] and citing section headings. Finally, propose the next Sensemaker step.`;

      // Final connection check before sending
      if (sessionStatus === "CONNECTED" && isWebRTCReady()) {
        try {
          sendUserText(analysisAsk);
          addTranscriptBreadcrumb("Analysis request sent");
        } catch (err) {
          console.error("Failed to send analysis request", err);
          addTranscriptBreadcrumb("Failed to send analysis request", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        console.warn("Session not ready during file processing");
        addTranscriptBreadcrumb("Upload failed: Session not ready");
      }

      // reset input value so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.onerror = () => {
      console.error("Failed to read file");
      addTranscriptBreadcrumb("Upload failed: Could not read file");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsDataURL(file);
  };

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
    isWebRTCReady,
  } = useRealtimeSession({
    onConnectionChange: (s) => {
      console.log("[App] onConnectionChange called with status:", s);
      setSessionStatus(s as SessionStatus);
      if (s === "DISCONNECTED") {
        connectionAttemptRef.current = false;
        // Clear queues when connection drops
        setPendingText(null);
        setMessageQueue([]);
      }
    },
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("audioPlaybackEnabled");
      return stored ? stored === "true" : true;
    }
  );
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const connectionAttemptRef = useRef<boolean>(false);

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot send event: session not ready", eventObj);
      return;
    }

    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error("Failed to send via SDK", err);
    }
  };

  useHandleSessionHistory();

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      // Reset flag after handling so subsequent effects behave normally
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
    }
  }, [isPTTActive]);

  // Flush queued messages when connection becomes available
  useEffect(() => {
    if (sessionStatus === "CONNECTED" && isWebRTCReady()) {
      // Process pending text first
      if (pendingText) {
        try {
          sendUserText(pendingText);
        } catch (err) {
          console.error("Failed to flush pending text", err);
        } finally {
          setPendingText(null);
        }
      }

      // Process message queue
      if (messageQueue.length > 0) {
        const messagesToProcess = [...messageQueue];
        setMessageQueue([]);

        messagesToProcess.forEach((message, index) => {
          try {
            // Add small delay between messages to avoid overwhelming the connection
            setTimeout(() => {
              if (sessionStatus === "CONNECTED" && isWebRTCReady()) {
                sendUserText(message);
              }
            }, index * 100);
          } catch (err) {
            console.error("Failed to flush queued message", err);
          }
        });
      }
    }
  }, [
    sessionStatus,
    pendingText,
    messageQueue.length,
    sendUserText,
    isWebRTCReady,
  ]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED" || connectionAttemptRef.current) {
        console.warn(
          "Connection attempt blocked: already connecting or connected"
        );
        return;
      }

      connectionAttemptRef.current = true;
      setSessionStatus("CONNECTING");
      addTranscriptBreadcrumb("Connecting to realtime session...");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) {
          setSessionStatus("DISCONNECTED");
          addTranscriptBreadcrumb("Connection failed: No ephemeral key");
          return;
        }

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex(
          (a) => a.name === selectedAgentName
        );
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        let companyName = chatSupervisorCompanyName;
        if (agentSetKey === "customerServiceRetail") {
          companyName = customerServiceRetailCompanyName;
        } else if (agentSetKey === "atchalta") {
          companyName = "Atchalta";
        }
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });

        addTranscriptBreadcrumb("Connected successfully");
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
        addTranscriptBreadcrumb("Connection failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        connectionAttemptRef.current = false;
      }
      return;
    }
  };

  const disconnectFromRealtime = () => {
    try {
      disconnect();
      addTranscriptBreadcrumb("Disconnected from realtime session");
    } catch (err) {
      console.error("Error during disconnect:", err);
    } finally {
      setSessionStatus("DISCONNECTED");
      setIsPTTUserSpeaking(false);
      connectionAttemptRef.current = false;
      // Clear any pending messages/text when disconnecting
      setPendingText(null);
      setMessageQueue([]);
    }
  };

  const sendSimulatedUserMessage = (text: string) => {
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot send simulated message: session not ready");
      return;
    }

    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: "conversation.item.create",
      item: {
        id,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendClientEvent(
      { type: "response.create" },
      "(simulated user text message)"
    );
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot update session: not ready");
      return;
    }

    // Reflect Push-to-Talk UI state by (de)activating server VAD on the
    // backend. The Realtime SDK supports live session updates via the
    // `session.update` event.
    const turnDetection = isPTTActive
      ? null
      : {
          type: "server_vad",
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    try {
      sendEvent({
        type: "session.update",
        session: {
          turn_detection: turnDetection,
        },
      });

      // Send an initial 'hi' message to trigger the agent to greet the user
      if (shouldTriggerResponse) {
        sendSimulatedUserMessage("hi");
      }
    } catch (err) {
      console.error("Failed to update session", err);
    }
  };

  const handleSendTextMessage = () => {
    const text = userText.trim();
    if (!text) return;

    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      // Queue the message and attempt to connect
      setMessageQueue((prev) => [...prev, text]);
      setUserText("");
      if (sessionStatus === "DISCONNECTED") {
        connectToRealtime();
      }
      return;
    }

    try {
      // Double-check connection status and WebRTC readiness before sending
      if (sessionStatus === "CONNECTED" && isWebRTCReady()) {
        interrupt();
        sendUserText(text);
        setUserText("");
      } else {
        // Connection not ready, queue the message
        setMessageQueue((prev) => [...prev, text]);
        setUserText("");
      }
    } catch (err) {
      console.error("Failed to send via SDK", err);
      // Re-queue the message if send fails
      setMessageQueue((prev) => [...prev, text]);
      setUserText("");
    }
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot start PTT: session not ready");
      return;
    }

    try {
      interrupt();
      setIsPTTUserSpeaking(true);
      sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
    } catch (err) {
      console.error("Failed to start PTT", err);
      setIsPTTUserSpeaking(false);
    }
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== "CONNECTED" || !isWebRTCReady()) {
      console.warn("Cannot end PTT: session not ready");
      setIsPTTUserSpeaking(false);
      return;
    }

    if (!isPTTUserSpeaking) return;

    try {
      setIsPTTUserSpeaking(false);
      sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
      sendClientEvent({ type: "response.create" }, "trigger response PTT");
    } catch (err) {
      console.error("Failed to end PTT", err);
    }
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", newAgentConfig);
    window.location.replace(url.toString());
  };

  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    // Reconnect session with the newly selected agent as root so that tool
    // execution works correctly.
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
    // connectToRealtime will be triggered by effect watching selectedAgentName
  };

  // Because we need a new connection, refresh the page when codec changes
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback.
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn("Failed to toggle SDK mute", err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn("mute sync after connect failed", err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => window.location.reload()}
        >
          <div>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div className="flex items-center gap-3">
            <span>
              Realtime API <span className="text-gray-500">Agents</span>
            </span>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  sessionStatus === "CONNECTED"
                    ? "bg-green-500"
                    : sessionStatus === "CONNECTING"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span
                className={`text-sm font-normal ${
                  sessionStatus === "CONNECTED"
                    ? "text-green-600"
                    : sessionStatus === "CONNECTING"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {sessionStatus === "CONNECTED"
                  ? "Connected"
                  : sessionStatus === "CONNECTING"
                  ? "Connecting..."
                  : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <label className="flex items-center text-base gap-1 mr-2 font-medium">
            Scenario
          </label>
          <div className="relative inline-block">
            <select
              value={agentSetKey}
              onChange={handleAgentChange}
              className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
            >
              {Object.keys(allAgentSets).map((agentKey) => (
                <option key={agentKey} value={agentKey}>
                  {agentKey}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {agentSetKey && (
            <div className="flex items-center ml-6">
              <label className="flex items-center text-base gap-1 mr-2 font-medium">
                Agent
              </label>
              <div className="relative inline-block">
                <select
                  value={selectedAgentName}
                  onChange={handleSelectedAgentChange}
                  className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
                >
                  {selectedAgentConfigSet?.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
          {/* Upload Map button */}
          <div className="ml-4 flex items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleMapFileSelected}
            />
            <button
              onClick={handleUploadButtonClick}
              disabled={sessionStatus !== "CONNECTED" || !isWebRTCReady()}
              className={`border border-gray-300 rounded-lg text-base px-3 py-1 ${
                sessionStatus === "CONNECTED" && isWebRTCReady()
                  ? "cursor-pointer bg-white hover:bg-gray-50"
                  : "cursor-not-allowed bg-gray-100 text-gray-400"
              }`}
              title={
                sessionStatus === "CONNECTED" && isWebRTCReady()
                  ? "Upload Sensemaker map screenshot"
                  : "Connect and wait for WebRTC ready"
              }
            >
              Upload Map
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={handleSendTextMessage}
          downloadRecording={downloadRecording}
          canSend={sessionStatus === "CONNECTED" && isWebRTCReady()}
        />

        <Events isExpanded={isEventsPaneExpanded} />
      </div>

      <BottomToolbar
        sessionStatus={sessionStatus}
        onToggleConnection={onToggleConnection}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        codec={urlCodec}
        onCodecChange={handleCodecChange}
      />
    </div>
  );
}

export default App;
