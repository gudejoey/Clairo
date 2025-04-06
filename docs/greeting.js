const AUDIO_FILE_URL = "assets/clairo-greeting.mp3";
const MOUTHMAP_JSON = "assets/clairo-phonemes.json";

document.addEventListener("DOMContentLoaded", async () => {
  const clairoDiv = document.querySelector(".clairo");
  const face = document.querySelector(".face");
  const clairoAudio = new Audio(AUDIO_FILE_URL);
  clairoAudio.preload = "auto";

  if (!clairoDiv || !face) {
    console.warn("Missing elements.");
    return;
  }

  const response = await fetch(MOUTHMAP_JSON);
  const schedule = await response.json();

  clairoDiv.addEventListener("click", () => {
    clairoAudio.currentTime = 0;
    clairoAudio.play();

    const startTime = performance.now();

    schedule.forEach(({ face: faceState, start }) => {
      const delay = start * 1000;
      setTimeout(() => {
        face.textContent = faceState;
      }, delay);
    });

    clairoAudio.addEventListener("ended", () => {
      face.textContent = ":)";
    });
  });
});
