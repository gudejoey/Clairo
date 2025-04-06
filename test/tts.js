const API_KEY = 'sk_b5b77653bf1cc410ea40387c22eca72efe4db1e7322e83ac';
const VOICE_ID = 'cgSgspJ2msm6clMCkdW9'; // e.g., Rachel, Bella, etc.

async function speak() {
  const text = document.getElementById('inputText').value;

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2', // or use 'eleven_multilingual_v1' for multilingual support
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    console.error('Error from ElevenLabs API:', response.statusText);
    return;
  }

  // Get the audio stream as a blob
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  // Play it in the browser
  const audio = document.getElementById('audio');
  audio.src = audioUrl;
  audio.play();
}
