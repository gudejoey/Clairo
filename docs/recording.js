const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const recorded = document.getElementById("recorded");
const startBtn = document.getElementById("start");

let stream;
let mediaRecorder;
let recordedChunks = [];
let animationFrame;

async function setupCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  preview.srcObject = stream;
}

setupCamera();

async function playFeedbackWithLipsync(text) {
  const audio = await elevenLabsTTS(text);
  const face = document.querySelector(".face");

  if (!face || !audio) return;

  // Start speaking and animate :D / :) alternation
  let showingSmile = true;
  face.textContent = ":)";
  const interval = setInterval(() => {
    face.textContent = showingSmile ? ":D" : ":)";
    showingSmile = !showingSmile;
  }, 250); // Toggle every 250ms

  audio.play();
  audio.addEventListener("ended", () => {
    clearInterval(interval);
    face.textContent = ":)";
  });
}

async function elevenLabsTTS(text) {
  const API_KEY = "sk_b5b77653bf1cc410ea40387c22eca72efe4db1e7322e83ac";
  const VOICE_ID = "cgSgspJ2msm6clMCkdW9"; // e.g., 'pNInz6obpgDQGcFmaJgB'

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
        },
      }),
    }
  );

  if (!response.ok) {
    console.error("ElevenLabs TTS error:", await response.text());
    return null;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  return new Audio(url);
}

function drawVideo() {
  canvas.width = preview.videoWidth;
  canvas.height = preview.videoHeight;

  ctx.save();
  ctx.translate(canvas.width, 0); // Flip horizontally
  ctx.scale(-1, 1);
  ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  animationFrame = requestAnimationFrame(drawVideo);
}

startBtn.onclick = () => {
  drawVideo();

  // Change button to stop recording
  startBtn.textContent = "Stop Recording";
  startBtn.style.backgroundColor = "#c44536";

  const canvasStream = canvas.captureStream();
  const audioTrack = stream.getAudioTracks()[0];
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    audioTrack,
  ]);

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(combinedStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const videoUrl = URL.createObjectURL(blob);
    recorded.src = videoUrl;

    // Replace preview with playback
    preview.style.display = "none";
    recorded.style.display = "block";

    // Hide record button
    startBtn.style.display = "none";

    // Hide the reading textbox
    document.querySelector(".textbox").style.display = "none";
    document.querySelector(".direction").style.display = "none";

    // Show the Clairo face and transcript feedback
    document.querySelector(".group").style.height = "100%";
    document.querySelector(".group").style.transform = "none";
    document.querySelector(".clairo").style.display = "flex";
    document.querySelector(".transcript").style.display = "block";
    const feedbackText =
      "Great job! You spoke clearly, but try slowing down in the middle. Keep practicing — you're improving every time.";

    await playFeedbackWithLipsync(feedbackText);
  };

  mediaRecorder.start();

  // Change button behavior to stop recording
  startBtn.onclick = () => {
    mediaRecorder.stop();
    cancelAnimationFrame(animationFrame);
  };
};
