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
