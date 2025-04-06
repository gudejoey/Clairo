// greeting.js (Simplified version using only :D and :) animation)

const AUDIO_FILE_URL = "assets/clairo-greeting.mp3";
const SPEAK_INTERVAL = 300; // duration to toggle face during speaking (ms)

document.addEventListener("DOMContentLoaded", () => {
  const clairoDiv = document.querySelector(".clairo");
  const face = document.querySelector(".face");
  const clairoAudio = new Audio(AUDIO_FILE_URL);
  clairoAudio.preload = "auto";

  if (!clairoDiv || !face) {
    console.warn("Missing required elements");
    return;
  }

  clairoDiv.addEventListener("click", () => {
    clairoAudio.currentTime = 0;
    clairoAudio.play();

    let showingSmile = true;
    face.textContent = ":)";
    const interval = setInterval(() => {
      face.textContent = showingSmile ? ":D" : ":)";
      showingSmile = !showingSmile;
    }, SPEAK_INTERVAL);

    clairoAudio.addEventListener("ended", () => {
      clearInterval(interval);
      face.textContent = ":)";
    });
  });
});
