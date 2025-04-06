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
let audioContext;
let audioAnalyser;
let mediaStreamSource;
let recordingData = {
  fillerWords: {
    like: 0,
    um: 0,
    uh: 0,
    hmm: 0,
    "you know": 0,
  },
  toneMetrics: {
    pace: 0, // 0-10 scale, 5 is ideal
    volume: 0, // 0-10 scale, 5 is ideal
    pitch: 0, // 0-10 scale, 5 is ideal
    variation: 0, // 0-10 scale, higher is better
  },
};

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

    // Setup audio analysis
    setupAudioAnalysis(stream);

    // Show start button once camera is ready
    startBtn.classList.add("ready");
    startBtn.disabled = false;
  } catch (err) {
    console.error("Camera access error:", err);
    alert("Please allow camera and microphone access to use this feature.");
  }
}

// Setup audio analysis
function setupAudioAnalysis(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioAnalyser = audioContext.createAnalyser();
  mediaStreamSource = audioContext.createMediaStreamSource(stream);
  mediaStreamSource.connect(audioAnalyser);

  // Configure analyser
  audioAnalyser.fftSize = 2048;
  audioAnalyser.smoothingTimeConstant = 0.8;
}

// Initialize camera on page load
document.addEventListener("DOMContentLoaded", () => {
  setupCamera();

  // Set initial button state
  startBtn.disabled = true;
  startBtn.textContent = "Start recording";
});

// Function to animate the lips in the Clairo face
async function playFeedbackWithLipsync(text) {
  if (!text) return;

  const face = document.querySelector(".face");
  const audio = await elevenLabsTTS(text);
  if (!face || !audio) return;

  const context = new AudioContext();
  const source = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  source.connect(analyser);
  analyser.connect(context.destination);

  const data = new Uint8Array(analyser.frequencyBinCount);

  function checkAudioEnergy() {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    face.textContent = avg > 15 ? ":D" : ":)";
    if (!audio.paused && !audio.ended) {
      requestAnimationFrame(checkAudioEnergy);
    } else {
      face.textContent = ":)";
    }
  }

  audio.play();
  context.resume();
  checkAudioEnergy();
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

// Analyze audio using Deepgram API
async function analyzeAudio(audioBlob) {
  loader.textContent = "Processing speech with Deepgram...";

  try {
    // Create FormData to send the audio blob
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    // Prepare Deepgram API URL with parameters
    const DEEPGRAM_API_KEY = "84c4003055c4866356807a20835d1b57acdf9908"; // Replace with your API key
    const apiUrl =
      "https://api.deepgram.com/v1/listen?smart_format=true&diarize=false&punctuate=true&filler_words=true&utterances=true&numerals=true&model=nova-2";

    // Send audio to Deepgram
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Deepgram API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Process Deepgram response
    return processDeepgramResponse(data);
  } catch (error) {
    console.error("Speech analysis error:", error);
    // Fallback metrics if API fails
    return {
      fillerWords: { like: 0, um: 0, uh: 0, hmm: 0, "you know": 0 },
      toneMetrics: { pace: 5, volume: 5, pitch: 5, variation: 5 },
    };
  }
}

// Process Deepgram API response to extract metrics
function processDeepgramResponse(data) {
  try {
    // Extract results from Deepgram response
    const results = data.results;
    const transcript = results.channels[0].alternatives[0].transcript;
    const words = results.channels[0].alternatives[0].words || [];

    // Extract utterances for pace analysis
    const utterances = results.utterances || [];

    // Initialize metrics
    let fillerWordCounts = {
      like: 0,
      um: 0,
      uh: 0,
      hmm: 0,
      "you know": 0,
    };

    // Count filler words
    for (const word of words) {
      const wordText = word.word.toLowerCase().trim();
      if (fillerWordCounts.hasOwnProperty(wordText)) {
        fillerWordCounts[wordText]++;
      }

      // Also check for combined words like "you know"
      if (wordText === "you" && words.indexOf(word) < words.length - 1) {
        const nextWord = words[words.indexOf(word) + 1].word
          .toLowerCase()
          .trim();
        if (nextWord === "know") {
          fillerWordCounts["you know"]++;
        }
      }
    }

    // Calculate speech pace (words per minute)
    let wordsPerMinute = 0;
    if (utterances.length > 0) {
      const totalWords = words.length;
      const totalDurationSeconds = utterances.reduce((sum, utterance) => {
        return sum + (utterance.end - utterance.start);
      }, 0);

      if (totalDurationSeconds > 0) {
        wordsPerMinute = (totalWords / totalDurationSeconds) * 60;
      }
    }

    // Calculate speech volume and pitch variation from audio features
    // (This is simulated as Deepgram doesn't directly provide these metrics)
    // In a production environment, you would use additional audio analysis for these metrics

    // Convert words per minute to 0-10 scale
    // 150 WPM is ideal (score of 5)
    const paceScore = calculatePaceScore(wordsPerMinute);

    // Analyze audio for volume patterns (estimated from confidence scores)
    const confidenceScores = words.map((w) => w.confidence || 0);
    const volumeScore = calculateVolumeScore(confidenceScores);

    // Analyze speech features for pitch and variation
    // This is estimated from pause patterns in the speech
    const pausePatterns = analyzePausePatterns(words);
    const pitchScore = 5; // Placeholder (requires audio analysis)
    const variationScore = calculateVariationScore(pausePatterns);

    return {
      fillerWords: fillerWordCounts,
      toneMetrics: {
        pace: paceScore,
        volume: volumeScore,
        pitch: pitchScore,
        variation: variationScore,
      },
    };
  } catch (error) {
    console.error("Error processing Deepgram response:", error);
    // Return default values if processing fails
    return {
      fillerWords: { like: 0, um: 0, uh: 0, hmm: 0, "you know": 0 },
      toneMetrics: { pace: 5, volume: 5, pitch: 5, variation: 5 },
    };
  }
}

// Calculate pace score on a 0-10 scale
function calculatePaceScore(wordsPerMinute) {
  // 150 WPM is considered ideal (score of 5)
  // Scale between 0-10 based on deviation from ideal
  if (wordsPerMinute <= 0) return 5; // Default if no data

  if (wordsPerMinute < 150) {
    // Slower than ideal
    return 5 - Math.min(5, (150 - wordsPerMinute) / 30);
  } else {
    // Faster than ideal
    return 5 + Math.min(5, (wordsPerMinute - 150) / 50);
  }
}

// Calculate volume score based on confidence patterns
function calculateVolumeScore(confidenceScores) {
  if (!confidenceScores || confidenceScores.length === 0) return 5;

  const avgConfidence =
    confidenceScores.reduce((sum, score) => sum + score, 0) /
    confidenceScores.length;

  // Scale average confidence (typically 0-1) to volume score (0-10)
  // Assuming confidence correlates somewhat with volume
  return Math.min(10, Math.max(0, avgConfidence * 10));
}

// Analyze pause patterns in speech for variation metrics
function analyzePausePatterns(words) {
  if (!words || words.length < 2) return { regularityScore: 0.5 };

  // Calculate time gaps between words
  const gaps = [];
  for (let i = 1; i < words.length; i++) {
    const currentWordStart = words[i].start;
    const prevWordEnd = words[i - 1].end;
    gaps.push(currentWordStart - prevWordEnd);
  }

  // Calculate standard deviation of gaps as a measure of variability
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const variance =
    gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to a 0-1 scale where higher means more varied (less regular)
  const regularityScore = Math.min(1, stdDev / 0.5);

  return { regularityScore };
}

// Calculate variation score based on pause patterns
function calculateVariationScore(pausePatterns) {
  // Convert regularity score (0-1) to variation score (0-10)
  // Higher variation is better for engaging speech
  return Math.min(10, Math.max(0, pausePatterns.regularityScore * 10));
}

// Generate personalized feedback based on analysis
function generateFeedback(data) {
  // Calculate total filler words
  const totalFillerWords = Object.values(data.fillerWords).reduce(
    (sum, count) => sum + count,
    0
  );

  // Determine the most common filler word
  let mostCommonFiller = "";
  let maxCount = 0;
  for (const [word, count] of Object.entries(data.fillerWords)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonFiller = word;
    }
  }

  // Determine tone strengths and areas for improvement
  const toneStrengths = [];
  const toneImprovements = [];

  // Pace feedback
  if (data.toneMetrics.pace < 4) {
    toneImprovements.push("speaking a bit faster to maintain engagement");
  } else if (data.toneMetrics.pace > 7) {
    toneImprovements.push("slowing down your pace for better clarity");
  } else {
    toneStrengths.push("well-balanced speaking pace");
  }

  // Volume feedback
  if (data.toneMetrics.volume < 4) {
    toneImprovements.push("projecting your voice more confidently");
  } else if (data.toneMetrics.volume > 8) {
    toneImprovements.push(
      "moderating your volume for a more conversational tone"
    );
  } else {
    toneStrengths.push("appropriate volume level");
  }

  // Pitch feedback
  if (data.toneMetrics.variation < 4) {
    toneImprovements.push("adding more vocal variety to engage listeners");
  } else {
    toneStrengths.push("good vocal inflection");
  }

  // Generate feedback text
  let feedbackText = `I noticed you used about ${totalFillerWords} filler words during your speech. `;

  if (totalFillerWords > 8) {
    feedbackText += `That's quite a few! Your most common filler word was "${mostCommonFiller}". Try pausing instead of using filler words. `;
  } else if (totalFillerWords > 3) {
    feedbackText += `Your most used filler was "${mostCommonFiller}". Consider replacing it with a brief pause. `;
  } else {
    feedbackText += `That's quite good! You used very few fillers. `;
  }

  // Add tone feedback
  if (toneStrengths.length > 0) {
    feedbackText += `Your strengths include ${toneStrengths.join(" and ")}. `;
  }

  if (toneImprovements.length > 0) {
    feedbackText += `You could improve by ${toneImprovements.join(" and ")}. `;
  }

  // Add encouragement
  feedbackText += "Keep practicing and you'll continue to improve!";

  return feedbackText;
}

// Create HTML content for the feedback display
function createFeedbackHTML(data) {
  // Create filler words HTML
  let fillerWordsHTML = "";
  let totalFillers = 0;

  for (const [word, count] of Object.entries(data.fillerWords)) {
    totalFillers += count;
    if (count > 0) {
      fillerWordsHTML += `<li>"${word}": ${count} time${
        count !== 1 ? "s" : ""
      }</li>`;
    }
  }

  if (fillerWordsHTML === "") {
    fillerWordsHTML = "<li>No filler words detected. Great job!</li>";
  }

  // Create tone metrics visualization
  const toneHTML = `
    <div class="tone-metrics">
      <div class="metric">
        <span>Pace:</span>
        <div class="meter">
          <div class="meter-fill" style="width: ${Math.min(
            90,
            data.toneMetrics.pace * 9
          )}%"></div>
        </div>
        <span>${data.toneMetrics.pace.toFixed(1)}/10</span>
      </div>
      <div class="metric">
        <span>Volume:</span>
        <div class="meter">
          <div class="meter-fill" style="width: ${Math.min(
            90,
            data.toneMetrics.pace * 9
          )}%"></div>
        </div>
        <span>${data.toneMetrics.volume.toFixed(1)}/10</span>

      </div>
      <div class="metric">
        <span>Pitch Variation:</span>
        <div class="meter">
          <div class="meter-fill" style="width: ${Math.min(
            90,
            data.toneMetrics.pace * 9
          )}%"></div>
        </div>
        <span>${data.toneMetrics.variation.toFixed(1)}/10</span>
      </div>
    </div>
  `;

  // Generate improvement tips based on the metrics
  let tipsHTML = "<ul>";

  // Pace tips
  if (data.toneMetrics.pace < 4) {
    tipsHTML +=
      "<li>Try increasing your speaking speed slightly to keep your audience engaged.</li>";
  } else if (data.toneMetrics.pace > 7) {
    tipsHTML +=
      "<li>Practice speaking more slowly and deliberately, especially on key points.</li>";
  }

  // Volume tips
  if (data.toneMetrics.volume < 4) {
    tipsHTML +=
      "<li>Work on projecting your voice with confidence. Try speaking from your diaphragm.</li>";
  } else if (data.toneMetrics.volume > 8) {
    tipsHTML +=
      "<li>Consider moderating your volume for a more conversational tone.</li>";
  }

  // Variation tips
  if (data.toneMetrics.variation < 4) {
    tipsHTML +=
      "<li>Add more variety to your tone by emphasizing important words and using strategic pauses.</li>";
  }

  // Filler word tips if needed
  if (totalFillers > 3) {
    tipsHTML +=
      "<li>Replace filler words with brief pauses. This gives you time to think and sounds more confident.</li>";
  }

  tipsHTML += "</ul>";

  return `
    <h2>Speech Analysis</h2>
    
    <h3>Filler Words</h3>
    <ul class="filler-list">
      ${fillerWordsHTML}
    </ul>
    
    <h3>Tone Analysis</h3>
    ${toneHTML}
    
    <h3>Improvement Tips</h3>
    ${tipsHTML}
    
    <button id="tryAgain" class="btn">Try Again</button>
  `;
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

    try {
      // Analyze the audio using Deepgram
      const analysisResults = await analyzeAudio(blob);

      // Clear loading indicator
      clearInterval(loadingInterval);
      loader.style.display = "none";

      // Show feedback UI
      document.querySelector(".group").style.height = "100%";
      document.querySelector(".group").style.transform = "none";
      document.querySelector(".clairo").style.display = "flex";
      document.querySelector(".clairo").addEventListener("click", () => {
        const feedbackText = generateFeedback(analysisResults);
        playFeedbackWithLipsync(feedbackText);
      });

      // Show transcript with fade-in effect
      const transcript = document.querySelector(".transcript");
      transcript.style.display = "block";
      transcript.style.opacity = "0";

      // Generate personalized feedback HTML
      transcript.innerHTML = createFeedbackHTML(analysisResults);

      // Fade in the transcript
      setTimeout(() => {
        transcript.style.transition = "opacity 0.5s ease-in";
        transcript.style.opacity = "1";
      }, 100);

      // Add event listener to the "Try Again" button
      document.getElementById("tryAgain").addEventListener("click", resetUI);

      // Generate and play feedback audio
      const feedbackText = generateFeedback(analysisResults);
      await playFeedbackWithLipsync(feedbackText);
    } catch (err) {
      console.error("Analysis error:", err);
      clearInterval(loadingInterval);
      loader.style.display = "none";
      alert("There was an error analyzing your speech. Please try again.");
      resetUI();
    }
  };

  mediaRecorder.start();

  // Update button to stop recording
  startBtn.onclick = stopRecording;
}

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

// Add CSS for the new feedback elements
const style = document.createElement("style");
style.innerHTML = `
  
  
  #loader {
    font-family: "Inter", sans-serif;
    color: var(--green);
    margin-top: 1rem;
  }
  
  .transcript h2 {
    margin-bottom: 1rem;
    color: var(--green);
    font-size: 2.4rem;
  }
  
  .transcript h3 {
    margin: 2rem 0 0.5rem 0;
    color: var(--green);
    font-size: 1.8rem;
  }
  
  .transcript ul {
    margin: 1rem 0 1rem 2rem;
    font-family: "Inter", sans-serif;
  }
  
  .transcript li {
    margin-bottom: 0.5rem;
  }
  
  .filler-list {
    list-style-type: disc;
  }
  
  .meter {
    height: 1rem;
    background-color: #e0e0e0;
    border-radius: 0.5rem;
    margin: 0 1rem;
    flex-grow: 1;
    overflow: hidden;
  }
  
  .meter-fill {
    height: 100%;
    background-color: var(--green);
    border-radius: 0.5rem;
    transition: width 1s ease-in-out;
  }
  
  .tone-metrics {
    margin: 1.5rem 0;
  }
  
  .metric {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .metric span {
    width: 12rem;
    font-family: "Inter", sans-serif;
  }
  
  .metric span:last-child {
    width: 4rem;
    text-align: right;
  }
  
  #tryAgain {
    margin-top: 2rem;
    width: auto;
    padding: 1rem 2rem;
  }
`;
document.head.appendChild(style);
