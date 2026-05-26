const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ENGINE STATE ---
let isEditorMode = false;
let bpm = 150;
let crotchet = (60 / bpm) * 1000; // Duration of one beat in ms
let stepCrotchet = crotchet / 4;   // Duration of one step (16th note) in ms

// Audio Tracking
let audioContext = null;
let audioBuffer = null;
let audioSource = null;
let startTime = 0;
let songTime = 0;
let isPlaying = false;

// Gameplay Variables
const STRUM_Y = 100;
const SCROLL_SPEED = 0.4; // Pixels per millisecond
const NOTE_CHANNELS = [400, 500, 600, 700]; // X positions for Left, Down, Up, Right

// Chart Data (Your Mod Maker saves to this)
let currentChart = {
    song: "Custom Song",
    bpm: 150,
    notes: [] // Array of { time: ms, lane: 0-3 }
};

// --- AUDIO CONDUCTOR CONFIG ---
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSong() {
    if (!audioBuffer) return;
    initAudio();
    
    if (audioSource) audioSource.stop();
    
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioContext.destination);
    
    startTime = audioContext.currentTime;
    audioSource.start(0);
    isPlaying = true;
}

// --- CORE GAME LOOP ---
function updateAndRender() {
    // Clear Screen
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background placeholder (You can replace this with your image draw)
    ctx.fillStyle = "#333";
    ctx.fillRect(50, 200, 300, 400); 

    // Update Song Time strictly based on Audio Context clock
    if (isPlaying) {
        songTime = (audioContext.currentTime - startTime) * 1000;
    }

    // 1. Draw Strum Receptors (Gray placeholder circles)
    NOTE_CHANNELS.forEach((x, index) => {
        ctx.fillStyle = "#555";
        ctx.beginPath();
        ctx.arc(x, STRUM_Y, 30, 0, Math.PI * 2);
        ctx.fill();
    });

    // 2. Draw Moving Notes
    ctx.fillStyle = "#ff007f";
    currentChart.notes.forEach(note => {
        // Core FNF Math: Position based on structural target time offset against current song playback time
        let noteY = STRUM_Y + (note.time - songTime) * SCROLL_SPEED;
        
        // Only draw if it's on screen
        if (noteY > -50 && noteY < canvas.height + 50) {
            ctx.fillRect(NOTE_CHANNELS[note.lane] - 25, noteY - 10, 50, 20);
        }
    });

    // 3. Render Editor Grid Lines if Mod Maker is Open
    if (isEditorMode) {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        // Drawing horizontal step markers relative to time scroll
        for (let i = 0; i < 200; i++) {
            let stepTime = i * stepCrotchet;
            let gridY = STRUM_Y + (stepTime - songTime) * SCROLL_SPEED;
            if (gridY > 0 && gridY < canvas.height) {
                ctx.beginPath();
                ctx.moveTo(350, gridY);
                ctx.lineTo(750, gridY);
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(updateAndRender);
}

// --- FILE DROPS & UPLOADS (THE PIPELINE) ---
document.getElementById('audioUpload').addEventListener('change', function(e) {
    initAudio();
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
        audioContext.decodeAudioData(evt.target.result, function(buffer) {
            audioBuffer = buffer;
            playSong();
        });
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('bpmInput').addEventListener('input', function(e) {
    bpm = parseInt(e.target.value) || 120;
    crotchet = (60 / bpm) * 1000;
    stepCrotchet = crotchet / 4;
    currentChart.bpm = bpm;
});

// --- ENGINE CONTROLS / INTERACTION ---
window.addEventListener('keydown', function(e) {
    // Tab toggles Mod Maker Interface
    if (e.key === 'Tab') {
        e.preventDefault();
        isEditorMode = !isEditorMode;
        document.getElementById('modMakerPanel').style.display = isEditorMode ? 'block' : 'none';
    }

    // Gameplay Input keys (DFJK / Arrow layouts mapped to 0, 1, 2, 3)
    let pressedLane = -1;
    if (e.key === 'd' || e.key === 'ArrowLeft') pressedLane = 0;
    if (e.key === 'f' || e.key === 'ArrowDown') pressedLane = 1;
    if (e.key === 'j' || e.key === 'ArrowUp')   pressedLane = 2;
    if (e.key === 'k' || e.key === 'ArrowRight') pressedLane = 3;

    if (pressedLane !== -1 && !isEditorMode) {
        // Hit Registration Check logic against safe frames window (approx 160ms max deviation)
        currentChart.notes.forEach((note, idx) => {
            if (note.lane === pressedLane) {
                let diff = Math.abs(note.time - songTime);
                if (diff < 160) {
                    currentChart.notes.splice(idx, 1); // Splice removes note on visual hit success
                }
            }
        });
    }
});

// Click Canvas to Place Chart Notes in Mod Maker Mode
canvas.addEventListener('click', function(e) {
    if (!isEditorMode) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Detect which lane column was clicked
    let lane = -1;
    NOTE_CHANNELS.forEach((x, index) => {
        if (Math.abs(mouseX - x) < 40) lane = index;
    });

    if (lane !== -1) {
        // Calculate timestamp matching the physical space clicked based on scroll configuration parameters
        let targetTime = songTime + (mouseY - STRUM_Y) / SCROLL_SPEED;
        // Snap directly to nearest musical step grid block
        let snappedTime = Math.round(targetTime / stepCrotchet) * stepCrotchet;
        
        currentChart.notes.push({ time: snappedTime, lane: lane });
        // Sort sequentially by timestamp order
        currentChart.notes.sort((a,b) => a.time - b.time);
    }
});

// Chart Exporter Data Compiler
document.getElementById('exportChartBtn').addEventListener('click', function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentChart, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "chart.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

// Run loop automatically on page entry
requestAnimationFrame(updateAndRender);
