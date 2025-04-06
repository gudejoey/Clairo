// Configuration
const DEEPGRAM_API_KEY = "afd6103b68a0acc2dac07619f2d35fc96651ff11"; // Replace with your actual API key
const OPENAI_API_KEY =
  "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"; // Replace with your actual API key
// Configuration

// DOM Elements
const recordBtn = document.getElementById("recordBtn");
const playbackBtn = document.getElementById("playbackBtn");
const videoPreview = document.getElementById("videoPreview");
const recordingIndicator = document.getElementById("recordingIndicator");
const visualizer = document.getElementById("visualizer");
const statusEl = document.getElementById("status");
const transcriptEl = document.getElementById("transcript");
const analysisEl = document.getElementById("analysis");
const exercisesEl = document.getElementById("exercises");

// App State
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let mediaStream;
let transcript = "";
let speechAnalysis = "";
let audioBlob = null;

// Initialize the app
function init() {
  recordBtn.addEventListener("click", toggleRecording);
  playbackBtn.addEventListener("click", playRecording);
}

// Toggle recording state
async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

// Start recording
async function startRecording() {
  try {
    // Reset state
    transcript = "";
    audioChunks = [];
    audioBlob = null;
    transcriptEl.textContent = "";
    analysisEl.innerHTML =
      '<div class="placeholder">Your analysis will appear here after recording</div>';
    exercisesEl.innerHTML =
      '<div class="placeholder">Personalized exercises will appear here</div>';
    playbackBtn.disabled = true;

    // Get media stream with both audio and video
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: true,
    });

    // Setup video preview
    videoPreview.srcObject = mediaStream;

    // Create media recorder for audio only (better for transcription)
    const audioStream = new MediaStream(mediaStream.getAudioTracks());
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 16000,
    });

    // Collect data chunks
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Create complete blob from chunks
      audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      // Enable playback button
      playbackBtn.disabled = false;

      // Transcribe the audio
      await transcribeAudio(audioBlob);
    };

    // Start recording
    mediaRecorder.start(1000); // Collect data every 1 second

    // Setup audio visualization
    setupVisualizer();

    // Update UI
    isRecording = true;
    recordBtn.classList.add("recording");
    recordBtn.querySelector(".text").textContent = "Stop Recording";
    recordingIndicator.classList.add("active");
    statusEl.textContent = "Listening... Speak now.";
  } catch (err) {
    console.error("Error accessing media devices:", err);
    statusEl.textContent =
      "Error: Could not access camera/microphone. Please check permissions.";
  }
}

// Stop recording
function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  mediaRecorder.stop();

  // Stop all tracks
  mediaStream.getTracks().forEach((track) => track.stop());

  // Clear visualizer
  visualizer.innerHTML = "";

  // Update UI
  recordBtn.classList.remove("recording");
  recordBtn.querySelector(".text").textContent = "Start Recording";
  recordingIndicator.classList.remove("active");
  statusEl.textContent = "Processing your recording...";

  // Clear video preview
  videoPreview.srcObject = null;
}

// Play back the recorded audio
function playRecording() {
  if (!audioBlob) return;

  const audioUrl = URL.createObjectURL(audioBlob);
  const audioPlayer = new Audio(audioUrl);
  audioPlayer.play();

  statusEl.textContent = "Playing back your recording...";

  audioPlayer.onended = () => {
    statusEl.textContent = "Playback complete";
  };
}

// Set up audio visualizer
function setupVisualizer() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 32;

  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(analyser);

  // Create visualizer bars
  visualizer.innerHTML = "";
  const bufferLength = analyser.frequencyBinCount;
  for (let i = 0; i < bufferLength; i++) {
    const bar = document.createElement("div");
    bar.className = "visualizer-bar";
    visualizer.appendChild(bar);
  }

  // Update visualization
  function updateVisualizer() {
    if (!isRecording) return;

    requestAnimationFrame(updateVisualizer);

    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const bars = visualizer.querySelectorAll(".visualizer-bar");
    bars.forEach((bar, i) => {
      const height = (dataArray[i] / 255) * 100;
      bar.style.height = `${height}%`;
      bar.style.backgroundColor = `hsl(${height}, 100%, 50%)`;
    });
  }

  updateVisualizer();
}

// Transcribe audio using Deepgram API
async function transcribeAudio(blob) {
  statusEl.textContent = "Transcribing your speech...";
  transcriptEl.innerHTML = '<div class="spinner"></div>';

  try {
    // Convert blob to file
    const audioFile = new File([blob], "recording.webm", {
      type: "audio/webm",
    });

    // Create FormData
    const formData = new FormData();
    formData.append("file", audioFile);

    // Add Deepgram parameters
    const params = new URLSearchParams({
      model: "nova",
      punctuate: "true",
      utterances: "true",
      diarize: "false",
    });

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params}`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract transcript from Deepgram response
    if (
      data.results &&
      data.results.channels &&
      data.results.channels[0].alternatives[0]
    ) {
      transcript = data.results.channels[0].alternatives[0].transcript;
      transcriptEl.textContent = transcript;

      if (transcript.trim().length > 0) {
        analyzeSpeech(transcript);
      } else {
        statusEl.textContent = "No speech detected. Try again.";
        transcriptEl.innerHTML =
          '<div class="placeholder">No speech detected in recording</div>';
      }
    } else {
      throw new Error("Unexpected response format from Deepgram");
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    statusEl.textContent = "Error transcribing speech. Please try again.";
    transcriptEl.innerHTML =
      '<div class="placeholder">Error in transcription</div>';
  }
}

// Analyze speech using OpenAI API
async function analyzeSpeech(text) {
  statusEl.textContent = "Analyzing your speech patterns...";
  analysisEl.innerHTML = '<div class="spinner"></div>';

  const ANALYSIS_PROMPT = `Analyze the following speech transcript for stuttering patterns. 
    Look for repetitions, prolongations, and blocks. Provide:
    1. A severity rating (mild, moderate, severe)
    2. Specific stuttering patterns detected
    3. Percentage of words affected by stuttering
    4. The most common sounds/words where stuttering occurs

    Format your response as follows:
    Severity: [rating]
    Patterns: [list of patterns]
    Percentage: [x%]
    Common Issues: [list of sounds/words]

    Transcript: ${text}`;

  try {
    // First get the analysis
    const analysisResponse = await callOpenAI(ANALYSIS_PROMPT);
    speechAnalysis = analysisResponse;

    // Display analysis
    displayAnalysis(analysisResponse);

    // Then get exercises based on the analysis
    const EXERCISES_PROMPT = `Based on the following stuttering analysis, provide 3 personalized speaking exercises to help improve fluency. 
        Include at least one tongue twister targeting the problematic sounds. 
        Format each exercise with a title, description, and instructions.

        Analysis: ${analysisResponse}
        Provide the exercises in this format:
        {
          "exercises": [
            {
              "title": "Exercise 1",
              "description": "...",
              "instructions": "..."
            },
            ...
          ]
        }`;

    const exercisesResponse = await callOpenAI(EXERCISES_PROMPT);

    // Display exercises
    displayExercises(exercisesResponse);

    statusEl.textContent = "Analysis complete!";
  } catch (error) {
    console.error("Error analyzing speech:", error);
    statusEl.textContent = "Error analyzing speech. Please try again.";
    analysisEl.innerHTML = '<div class="placeholder">Error in analysis</div>';
  }
}

// Call OpenAI API
async function callOpenAI(prompt) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}
// Improved analysis prompt with strict formatting
async function getStutterAnalysis(text) {
  const prompt = `Analyze this speech transcript for stuttering patterns. Provide:
1. Severity: mild/moderate/severe
2. Patterns: Comma-separated list of specific patterns
3. Percentage: Numerical percentage only
4. Issues: Comma-separated list of sounds/words

Format EXACTLY like this:
Severity: [value]
Patterns: [value]
Percentage: [value]
Issues: [value]

Transcript: ${text}`;

  return await callOpenAI(prompt);
}

// Enhanced displayAnalysis with robust parsing
function displayAnalysis(analysisText) {
  const result = {
    severity: extractValue(analysisText, "Severity:"),
    patterns: extractValue(analysisText, "Patterns:"),
    percentage: extractValue(analysisText, "Percentage:"),
    issues: extractValue(analysisText, "Issues:"),
  };

  let html = "";

  if (result.severity) {
    const colorMap = {
      mild: "#4CAF50",
      moderate: "#FFC107",
      severe: "#F44336",
    };
    const color = colorMap[result.severity.toLowerCase()] || "#4361ee";
    html += `<p><strong>Severity:</strong> <span style="color: ${color}">${result.severity}</span></p>`;
  }

  if (result.patterns) {
    html += `<p><strong>Patterns:</strong> ${result.patterns}</p>`;
  }

  if (result.percentage) {
    html += `<div class="progress-container">
            <p><strong>Affected Words:</strong> ${result.percentage}%</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${result.percentage}%"></div>
            </div>
        </div>`;
  }

  if (result.issues) {
    html += `<p><strong>Problem Areas:</strong> ${result.issues}</p>`;
  }

  analysisEl.innerHTML =
    html || `<div class="placeholder">${analysisText}</div>`;
}

function extractValue(text, prefix) {
  const line = text.split("\n").find((l) => l.startsWith(prefix));
  return line ? line.replace(prefix, "").trim() : null;
}

// Enhanced exercise prompt with JSON validation
async function getExercises(analysis) {
  const prompt = `Create 3 speaking exercises based on this stuttering analysis.
Include one tongue twister targeting problematic sounds.

Analysis: ${analysis}

Respond with VALID JSON in this format:
{
    "exercises": [
        {
            "title": "Exercise Title",
            "description": "Short description",
            "instructions": "Step-by-step instructions"
        }
    ]
}`;

  return await callOpenAI(prompt);
}

// Display analysis results
function displayAnalysis(analysisText) {
  let formattedAnalysis = analysisText;

  if (analysisText.includes("Severity:")) {
    const parts = analysisText.split("\n");
    formattedAnalysis = parts
      .map((part) => {
        if (part.startsWith("Severity:")) {
          const severity = part.split(":")[1].trim();
          let color = "#4CAF50"; // green
          if (severity.toLowerCase().includes("moderate")) color = "#FFC107"; // yellow
          if (severity.toLowerCase().includes("severe")) color = "#F44336"; // red
          return `<p><strong>Severity:</strong> <span style="color: ${color}">${severity}</span></p>`;
        }
        if (part.startsWith("Patterns:")) {
          const patterns = part.split(":")[1].trim();
          return `<p><strong>Patterns:</strong> ${patterns}</p>`;
        }
        if (part.startsWith("Percentage:")) {
          const percentage = part.split(":")[1].trim();
          return `<div class="progress-container">
                    <p><strong>Percentage of words affected:</strong> ${percentage}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}"></div>
                    </div>
                </div>`;
        }
        if (part.startsWith("Common Issues:")) {
          const issues = part.split(":")[1].trim();
          return `<p><strong>Common Issues:</strong> ${issues}</p>`;
        }
        return `<p>${part}</p>`;
      })
      .join("");
  }

  analysisEl.innerHTML = formattedAnalysis;
}

// Display exercises
function displayExercises(exercisesText) {
  try {
    let exercisesData;
    if (exercisesText.trim().startsWith("{")) {
      exercisesData = JSON.parse(exercisesText);
    } else {
      const jsonMatch = exercisesText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        exercisesData = JSON.parse(jsonMatch[0]);
      } else {
        exercisesEl.innerHTML = exercisesText;
        return;
      }
    }

    if (exercisesData.exercises && exercisesData.exercises.length > 0) {
      let exercisesHTML = "";
      exercisesData.exercises.forEach((exercise) => {
        let isTongueTwister =
          exercise.title.toLowerCase().includes("tongue") ||
          exercise.description.toLowerCase().includes("tongue");

        exercisesHTML += `
                    <div class="exercise">
                        <h4>${exercise.title}</h4>
                        <p>${exercise.description}</p>
                        ${
                          isTongueTwister
                            ? `<div class="tongue-twister">${exercise.instructions}</div>`
                            : `<p><strong>Instructions:</strong> ${exercise.instructions}</p>`
                        }
                    </div>
                `;
      });
      exercisesEl.innerHTML = exercisesHTML;
    } else {
      exercisesEl.innerHTML =
        '<div class="placeholder">No exercises generated. Please try again.</div>';
    }
  } catch (error) {
    console.error("Error parsing exercises:", error);
    exercisesEl.innerHTML = exercisesText;
  }
}

// Initialize the app when the page loads
window.addEventListener("DOMContentLoaded", init);
