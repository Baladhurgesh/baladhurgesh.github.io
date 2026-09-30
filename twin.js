import { Conversation } from "https://esm.sh/@elevenlabs/client@0.12.2";

const TOKEN_URL = "https://bala-recruitment-twin.vercel.app/api/conversation-token";
const STORAGE_KEY = "bala-twin-overlay-dismissed";

const overlay = document.getElementById("twin-overlay");
const openBtn = document.getElementById("twin-open");
const skipBtn = document.getElementById("twin-skip");
const revealBtn = document.getElementById("twin-reveal");
const endBtn = document.getElementById("twin-end");
const orbBtn = document.getElementById("twin-orb");
const canvas = document.getElementById("twin-canvas");
const orbIcon = document.getElementById("twin-orb-icon");
const statusEl = document.getElementById("twin-status");
const errorEl = document.getElementById("twin-error");

if (overlay && orbBtn) {
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

    if (status === "idle") statusEl.textContent = "Tap to start conversation";
    else if (status === "connecting") statusEl.textContent = "Connecting…";
    else if (status === "connected") {
      statusEl.textContent = isSpeaking ? "Bala is speaking…" : "Listening…";
    } else if (status === "disconnected") statusEl.textContent = "Conversation ended";

    orbBtn.disabled = status === "connecting";
    endBtn.hidden = status !== "connected";

    const connected = status === "connected";
    orbBtn.classList.toggle("is-connected", connected);
    orbBtn.classList.toggle("is-speaking", connected && isSpeaking);
    orbIcon.classList.toggle("is-hidden", connected);
    orbIcon.hidden = connected;
    canvas.hidden = !connected;
  }

  function openOverlay() {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("twin-locked");
    revealBtn?.focus();
  }

  async function closeOverlay(persist = true) {
    if (conversation) {
      try {
        await conversation.endSession();
      } catch {
        // ignore teardown errors
      }
      conversation = null;
      stopVisualizer();
    }

    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("twin-locked");
    setStatus("idle");
    setError(null);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // private browsing
      }
    }

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
  skipBtn?.addEventListener("click", () => closeOverlay(true));
  revealBtn?.addEventListener("click", () => closeOverlay(true));
  openBtn?.addEventListener("click", () => openOverlay());

  document.addEventListener("keydown", (e) => {
    if (overlay.hidden) return;
    if (e.key === "Escape") closeOverlay(true);
  });

  let dismissed = false;
  try {
    dismissed = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    dismissed = false;
  }

  if (!dismissed) {
    openOverlay();
  }
}
