// Simple audio player for Clairo's speech

// Create the Audio object once and reuse it
const clairoAudio = new Audio("../assets/clairo-greeting.mp3");

// Optional: preload the audio
clairoAudio.preload = "auto";

// Hook up the click event
document.addEventListener("DOMContentLoaded", () => {
  const clairoDiv = document.querySelector(".clairo");

  if (clairoDiv) {
    clairoDiv.addEventListener("click", () => {
      try {
        clairoAudio.currentTime = 0; // Restart from beginning each click
        clairoAudio.play();
      } catch (err) {
        console.error("Failed to play audio:", err);
      }
    });
  } else {
    console.warn('No element with class ".clairo" found.');
  }
});
