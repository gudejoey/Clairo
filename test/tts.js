const API_KEY = "sk_b5b77653bf1cc410ea40387c22eca72efe4db1e7322e83ac";

const VOICE_ID = "cgSgspJ2msm6clMCkdW9"; // e.g., Rachel, Bella, etc.

async function speak() {
  const text = document.getElementById("inputText").value;

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
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Error from ElevenLabs API:", response.statusText, errText);
    return;
  }

  // Create audio blob and URL
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  // 🔊 Play audio
  const audio = document.getElementById("audio");
  audio.src = audioUrl;
  audio.play();

  // 💾 Trigger file download
  const a = document.createElement("a");
  a.href = audioUrl;
  a.download = "clairo-speech.mp3"; // Set the filename here
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
