const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const recorded = document.getElementById("recorded");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const formData = new FormData();

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

function drawFlippedVideo() {
  ctx.save();
  ctx.scale(-1, 1); // mirror horizontally
  ctx.drawImage(preview, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();
  animationFrame = requestAnimationFrame(drawFlippedVideo);
}

startBtn.onclick = () => {
  drawFlippedVideo();

  // Capture canvas (flipped video) and combine audio
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
      console.log("Chunk received:", event.data.size);
    } else {
      console.log("Empty chunk received.");
    }
  };

  mediaRecorder.onstop = () => {
    console.log("Recorded chunks:", recordedChunks);
    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    console.log("Blob size:", blob.size);
    if (blob.size === 0) {
      console.error("No data recorded!");
      return;
    }
    // ...rest of the code to send blob via FormData
    // Send blob to Flask for Deepgram processing
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm"); // Make sure to match your Flask route

    // Show loading message
    const resultDiv = document.getElementById("results");
    resultDiv.innerHTML = `<p>Analyzing your speech...</p>`;

    fetch("http://127.0.0.1:5000/process", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        resultDiv.innerHTML = `
          <h3>Fluency Analysis</h3>
          <p><strong>Fluency Score:</strong> ${data.fluency_score}/100</p>
          <p><strong>Filler Words:</strong> ${
            data.filler_words.join(", ") || "None"
          }</p>
          <p><strong>Repeated Words:</strong> ${
            data.repeated_words.join(", ") || "None"
          }</p>
        `;
      })
      .catch((err) => {
        console.error("Error:", err);
        resultDiv.innerHTML = `<p style="color:red;">Something went wrong while processing the audio.</p>`;
      });
  };

  mediaRecorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

formData.append("audio", blob, "recording.wav"); // Deepgram supports wav, mp3, etc.
