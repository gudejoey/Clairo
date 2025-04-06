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

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const videoUrl = URL.createObjectURL(blob);
    recorded.src = videoUrl;

    preview.style.display = "none";
    recorded.style.display = "block";
    startBtn.style.display = "none"; // Hide button after recording
  };

  mediaRecorder.start();

  // Change button behavior to stop recording
  startBtn.onclick = () => {
    mediaRecorder.stop();
    cancelAnimationFrame(animationFrame);
  };
};
