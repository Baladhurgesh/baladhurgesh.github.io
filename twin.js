import { Conversation } from "https://esm.sh/@elevenlabs/client@0.12.2";

const TOKEN_URL = "https://bala-recruitment-twin.vercel.app/api/conversation-token";

const dock = document.getElementById("twin-dock");
const panel = document.getElementById("twin-panel");
const openBtn = document.getElementById("twin-open");
const closeBtn = document.getElementById("twin-close");
const endBtn = document.getElementById("twin-end");
const orbBtn = document.getElementById("twin-orb");
const canvas = document.getElementById("twin-canvas");
const orbIcon = document.getElementById("twin-orb-icon");
const statusEl = document.getElementById("twin-status");
const errorEl = document.getElementById("twin-error");

if (dock && panel && orbBtn) {
  let conversation = null;
  let status = "idle";
  let animationId = null;
  let isSpeaking = false;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setError(message) {
    if (!errorEl) return;
    if (message) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  }

  function setStatus(next) {
    status = next;
    if (!statusEl) return;

    if (status === "idle") statusEl.textContent = "Tap the orb to talk";
    else if (status === "connecting") statusEl.textContent = "Connecting…";
    else if (status === "connected") {
      statusEl.textContent = isSpeaking ? "Bala is speaking…" : "Listening…";
    } else if (status === "disconnected") statusEl.textContent = "Conversation ended";

    orbBtn.disabled = status === "connecting";
    endBtn.hidden = status !== "connected";
    panel.classList.toggle("is-live", status === "connecting" || status === "connected");

    const connected = status === "connected";
    orbBtn.classList.toggle("is-connected", connected);
    orbBtn.classList.toggle("is-speaking", connected && isSpeaking);
    orbIcon.classList.toggle("is-hidden", connected);
    orbIcon.hidden = connected;
    canvas.hidden = !connected;
  }

  function openPanel() {
    document.documentElement.classList.remove("twin-dismissed");
    document.documentElement.classList.add("twin-welcome");
    panel.hidden = false;
    dock.classList.add("is-open");
    document.body.classList.add("twin-open");
    orbBtn.focus();
  }

  async function closePanel() {
    if (conversation) {
      try {
        await conversation.endSession();
      } catch {
        // ignore teardown errors
      }
      conversation = null;
      stopVisualizer();
    }

    panel.hidden = true;
    dock.classList.remove("is-open");
    document.body.classList.remove("twin-open");
    document.documentElement.classList.remove("twin-welcome");
    document.documentElement.classList.add("twin-dismissed");
    setStatus("idle");
    setError(null);
    const calendly = document.querySelector("#twin-calendly");
    if (calendly) calendly.hidden = true;
    openBtn?.focus();
  }

  function stopVisualizer() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function startVisualizer() {
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const input = conversation?.getInputByteFrequencyData?.() || new Uint8Array(0);
      const output = conversation?.getOutputByteFrequencyData?.() || new Uint8Array(0);
      const inputLevel = input.length
        ? Array.from(input).reduce((a, b) => a + b, 0) / input.length / 255
        : 0;
      const outputLevel = output.length
        ? Array.from(output).reduce((a, b) => a + b, 0) / output.length / 255
        : 0;
      const level = Math.max(inputLevel, outputLevel, 0.15);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(cx, cy) - 6;
      const radius = maxR * (0.72 + level * 0.22);

      ctx.clearRect(0, 0, w, h);

      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue("--accent").trim() || "#e07a3c";
      const soft = styles.getPropertyValue("--accent-soft").trim() || "rgba(224,122,60,0.16)";

      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fillStyle = soft;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSpeaking ? "#c96a38" : accent;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx - radius * 0.22, cy - radius * 0.22, radius * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fill();

      animationId = requestAnimationFrame(draw);
    };

    stopVisualizer();
    draw();
  }

  async function requestMic() {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  async function getConversationToken() {
    const response = await fetch(TOKEN_URL, { method: "GET" });
    if (!response.ok) {
      throw new Error("Could not start a private voice session.");
    }
    const data = await response.json();
    if (!data?.token) {
      throw new Error("Voice session token was missing.");
    }
    return data.token;
  }

  async function startConversation() {
    setError(null);

    try {
      await requestMic();
    } catch {
      setError("Microphone access is required to talk with the digital twin.");
      return;
    }

    setStatus("connecting");

    try {
      const conversationToken = await getConversationToken();
      conversation = await Conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
        clientTools: {
          offer_calendly: async () => {
            const link = document.querySelector("#twin-calendly");
            if (link) link.hidden = false;
            return "Showed the 30-minute Calendly link on screen: https://calendly.com/baladhurgeshbp/30min";
          },
        },
        onConnect: () => {
          setStatus("connected");
          startVisualizer();
        },
        onDisconnect: () => {
          stopVisualizer();
          conversation = null;
          setStatus("disconnected");
        },
        onError: (error) => {
          const message = typeof error === "string" ? error : "Something went wrong with the voice session.";
          setError(message);
          stopVisualizer();
          conversation = null;
          setStatus("idle");
        },
        onModeChange: (mode) => {
          isSpeaking = mode.mode === "speaking";
          if (status === "connected") setStatus("connected");
        },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to start conversation.");
      setStatus("idle");
    }
  }

  async function endConversation() {
    if (conversation) {
      await conversation.endSession();
      conversation = null;
    }
    stopVisualizer();
    setStatus("idle");
  }

  orbBtn.addEventListener("click", () => {
    if (status === "idle" || status === "disconnected") startConversation();
  });

  endBtn?.addEventListener("click", endConversation);
  openBtn?.addEventListener("click", openPanel);
  closeBtn?.addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (panel.hidden) return;
    if (e.key === "Escape") closePanel();
  });

  openPanel();
}
