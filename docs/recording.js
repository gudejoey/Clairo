const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const recorded = document.getElementById("recorded");
const startBtn = document.getElementById("start");
const loader = document.getElementById("loader");

let stream;
let mediaRecorder;
let recordedChunks = [];
let animationFrame;
let isRecording = false;

// Loading animation variables
let dotCount = 0;
let loadingInterval;

// Setup camera when page loads
async function setupCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    preview.srcObject = stream;

    // Show start button once camera is ready
    startBtn.classList.add("ready");
    startBtn.disabled = false;
  } catch (err) {
    console.error("Camera access error:", err);
    alert("Please allow camera and microphone access to use this feature.");
  }
}

// Initialize camera on page load
document.addEventListener("DOMContentLoaded", () => {
  setupCamera();

  // Set initial button state
  startBtn.disabled = true;
  startBtn.textContent = "Getting camera ready...";
});

// Function to animate the lips in the Clairo face
async function playFeedbackWithLipsync(text) {
  const audio = await elevenLabsTTS(text);
  const face = document.querySelector(".face");

  if (!face || !audio) return;

  // Add transition for smoother animation
  face.style.transition = "transform 0.2s";

  // Start speaking and animate between expressions
  let showingSmile = true;
  face.textContent = ":)";

  const interval = setInterval(() => {
    if (showingSmile) {
      face.textContent = ":D";
      face.style.transform = "scale(1.1)";
    } else {
      face.textContent = ":)";
      face.style.transform = "scale(1)";
    }
    showingSmile = !showingSmile;
  }, 300); // Slightly slower for more natural look

  // Play the audio
  audio.play();

  // Clean up when done
  audio.addEventListener("ended", () => {
    clearInterval(interval);
    face.textContent = ":)";
    face.style.transform = "scale(1)";
  });
}

// Get audio feedback from Eleven Labs
async function elevenLabsTTS(text) {
  loader.textContent = "Generating feedback...";
  loader.style.display = "block";

  const API_KEY = "sk_b5b77653bf1cc410ea40387c22eca72efe4db1e7322e83ac";
  const VOICE_ID = "cgSgspJ2msm6clMCkdW9";

  try {
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
      loader.style.display = "none";
      return null;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    loader.style.display = "none";
    return new Audio(url);
  } catch (err) {
    console.error("TTS generation error:", err);
    loader.style.display = "none";
    return null;
  }
}

// Draw video frames to canvas (for recording)
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

// Update loading dots animation
function updateLoadingText() {
  dotCount = (dotCount % 3) + 1;
  const dots = ".".repeat(dotCount);
  loader.textContent = `Analyzing your speech${dots}`;
}

// Start recording function
function startRecording() {
  isRecording = true;
  drawVideo();

  // Update UI
  startBtn.textContent = "Stop Recording";
  startBtn.style.backgroundColor = "#c44536";

  // Add a pulse animation to the button
  startBtn.classList.add("recording");

  // Get media streams
  const canvasStream = canvas.captureStream();
  const audioTrack = stream.getAudioTracks()[0];
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    audioTrack,
  ]);

  // Setup recorder
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(combinedStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    // Show loading state
    loader.style.display = "block";
    loadingInterval = setInterval(updateLoadingText, 500);

    // Process recording
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const videoUrl = URL.createObjectURL(blob);
    recorded.src = videoUrl;

    // Update UI - hide recording elements
    preview.style.display = "none";
    recorded.style.display = "block";
    startBtn.style.display = "none";
    document.querySelector(".textbox").style.display = "none";
    document.querySelector(".direction").style.display = "none";

    // Short delay to simulate AI processing
    setTimeout(async () => {
      // Clear loading indicator
      clearInterval(loadingInterval);
      loader.style.display = "none";

      // Show feedback UI
      document.querySelector(".group").style.height = "100%";
      document.querySelector(".group").style.transform = "none";
      document.querySelector(".clairo").style.display = "flex";

      // Show transcript with fade-in effect
      const transcript = document.querySelector(".transcript");
      transcript.style.display = "block";
      transcript.style.opacity = "0";
      transcript.innerHTML = `
        <h2>Feedback</h2>
        <p>Great job! You read with good clarity and expression.</p>
        <p>Here are some observations:</p>
        <ul>
          <li>Your pacing was excellent at the beginning and end</li>
          <li>Try slowing down slightly in the middle section</li>
          <li>Your pronunciation of "unique" and "York" was very clear</li>
          <li>The "p" sounds in "Peter Piper" could use a bit more emphasis</li>
        </ul>
        <p>Keep practicing — you're improving with every recording!</p>
        <button id="tryAgain" class="btn">Try Again</button>
      `;

      // Fade in the transcript
      setTimeout(() => {
        transcript.style.transition = "opacity 0.5s ease-in";
        transcript.style.opacity = "1";
      }, 100);

      // Add event listener to the "Try Again" button
      document.getElementById("tryAgain").addEventListener("click", resetUI);
    }, 2500);
  };

  mediaRecorder.start();

  // Update button to stop recording
  startBtn.onclick = stopRecording;
}

document.addEventListener("DOMContentLoaded", () => {
  const clairo = document.querySelector(".clairo");

  if (clairo) {
    clairo.addEventListener("click", () => {
      const feedbackText =
        "Great job! You spoke clearly, but try slowing down in the middle. Keep practicing — you're improving every time.";
      playFeedbackWithLipsync(feedbackText);
    });
  }
});

// Stop recording function
function stopRecording() {
  if (isRecording) {
    mediaRecorder.stop();
    cancelAnimationFrame(animationFrame);
    isRecording = false;
    startBtn.classList.remove("recording");
  }
}

// Reset UI for another attempt
function resetUI() {
  // Hide feedback elements
  document.querySelector(".clairo").style.display = "none";
  document.querySelector(".transcript").style.display = "none";

  // Show recording elements
  preview.style.display = "block";
  recorded.style.display = "none";
  startBtn.style.display = "block";
  document.querySelector(".textbox").style.display = "block";
  document.querySelector(".direction").style.display = "block";

  // Reset button
  startBtn.textContent = "Start recording";
  startBtn.style.backgroundColor = "var(--green)";
  startBtn.classList.remove("recording");

  // Reset group styling
  document.querySelector(".group").style.height = "36vw";
  document.querySelector(".group").style.transform = "translateY(-3rem)";

  // Set button click handler back to start recording
  startBtn.onclick = startRecording;
}

// Set initial button handler
startBtn.onclick = startRecording;

// Add some CSS dynamically for the recording animation
const style = document.createElement("style");
style.innerHTML = `
  .btn.recording {
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  #loader {
    font-family: "Inter", sans-serif;
    color: var(--green);
    margin-top: 1rem;
  }
  
  .transcript h2 {
    margin-bottom: 1rem;
  }
  
  .transcript ul {
    margin: 1rem 0 1rem 2rem;
    font-family: "Inter", sans-serif;
  }
  
  .transcript li {
    margin-bottom: 0.5rem;
  }
  
  #tryAgain {
    margin-top: 2rem;
    width: auto;
    padding: 1rem 2rem;
  }
`;
document.head.appendChild(style);
