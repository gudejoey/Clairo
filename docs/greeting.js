// greeting.js (Final: JSON-based animation)

const AUDIO_FILE_URL = "../assets/clairo-greeting.mp3";
const PHONEME_JSON_URL = "../assets/clairo-phonemes.json";

const visemeMap = {
  A: ["AA", "AH", "AO"],
  E: ["EH", "IY", "EY"],
  M: ["M", "B", "P"],
  L: ["L", "N", "D", "T"],
  S: ["S", "Z", "SH", "CH"],
  O: ["OW", "UH", "UW"],
};

const faceMap = {
  A: ":O",
  E: ":D",
  M: ":|",
  L: ":)",
  S: ":s",
  O: ":O",
};

function getViseme(phoneme) {
  for (let [viseme, phones] of Object.entries(visemeMap)) {
    if (phones.includes(phoneme)) return viseme;
  }
  return "L";
}

async function loadPhonemeSchedule(jsonPath) {
  const res = await fetch(jsonPath);
  return await res.json();
}

function animateFace(audioElement, schedule) {
  const face = document.querySelector(".face");

  schedule.forEach(({ phoneme, start }) => {
    const viseme = getViseme(phoneme);
    const faceText = faceMap[viseme];

    setTimeout(() => {
      face.textContent = faceText;
      setTimeout(() => (face.textContent = ":)"), 100);
    }, start * 1000);
  });

  audioElement.play();
}

// Setup on load
document.addEventListener("DOMContentLoaded", async () => {
  const clairoDiv = document.querySelector(".clairo");
  const clairoAudio = new Audio(AUDIO_FILE_URL);
  clairoAudio.preload = "auto";

  try {
    const schedule = await loadPhonemeSchedule(PHONEME_JSON_URL);

    if (clairoDiv) {
      clairoDiv.addEventListener("click", () => {
        clairoAudio.currentTime = 0;
        animateFace(clairoAudio, schedule);
      });
    } else {
      console.warn('No element with class ".clairo" found.');
    }
  } catch (err) {
    console.error("Failed to load phoneme schedule:", err);
  }
});
