import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [started, setStarted] = useState(false)
  const [isNight, setIsNight] = useState(false)
  // Store volume levels (0.0 to 1.0)
  const [vols, setVols] = useState({ rain: 0, drone: 0, rumble: 0 })

  const audioCtx = useRef(null)
  const nodes = useRef({}) // Store audio nodes to control them later
  const canvasRef = useRef(null)

  // --- AUDIO GENERATORS (PURE MATH) ---

  // 1. Create Pink Noise (sounds like Rain/Water)
  const createPinkNoise = (ctx) => {
    const bufferSize = 2 * ctx.sampleRate; // 2 seconds buffer
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; // compensate for gain
      b6 = white * 0.115926;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    return noise;
  }

  // 2. Create Brown Noise (Sounds like Rumble/Thunder)
  const createBrownNoise = (ctx) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; 
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    return noise;
  }

  // --- INITIALIZE ENGINE ---
  const startEngine = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    audioCtx.current = ctx

    // MASTER GAIN (Volume Control)
    const rainGain = ctx.createGain(); rainGain.gain.value = 0;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0;
    const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;

    // 1. SETUP RAIN (Pink Noise)
    const rainSrc = createPinkNoise(ctx);
    rainSrc.connect(rainGain);
    rainGain.connect(ctx.destination);
    rainSrc.start(0);

    // 2. SETUP DRONE (Oscillators)
    // We use 2 oscillators slightly detuned for a rich sound
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine'; osc1.frequency.value = 110; // A2
    osc2.type = 'triangle'; osc2.frequency.value = 112; // Slightly detuned
    
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 400; // Muffle it a bit

    osc1.connect(droneFilter);
    osc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);
    
    osc1.start(0);
    osc2.start(0);

    // 3. SETUP RUMBLE (Brown Noise)
    const rumbleSrc = createBrownNoise(ctx);
    rumbleSrc.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumbleSrc.start(0);

    // Store nodes to control volume later
    nodes.current = {
        rain: rainGain,
        drone: droneGain,
        rumble: rumbleGain,
        osc1, osc2 // Store oscs to change pitch based on time
    }

    // CHECK TIME OF DAY
    const hour = new Date().getHours();
    const night = hour >= 18 || hour < 6;
    setIsNight(night);
    
    // Change drone pitch if night (lower/darker)
    if (night) {
        osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 (Lower)
        osc2.frequency.setValueAtTime(56, ctx.currentTime);
    }

    setStarted(true)
  }

  const handleVol = (type, val) => {
    const v = parseFloat(val);
    setVols(prev => ({...prev, [type]: v}));
    
    // Smooth volume transition
    if (audioCtx.current && nodes.current[type]) {
        nodes.current[type].gain.setTargetAtTime(v, audioCtx.current.currentTime, 0.1);
    }
  }

  // --- VISUALS (CANVAS) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    
    // Resize
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    // Initialize Particles
    for(let i=0; i<100; i++) particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        s: Math.random() * 2 + 0.5, // speed
        l: Math.random() * 20 + 5   // length
    });

    const draw = () => {
        // Background color based on time
        ctx.fillStyle = isNight ? '#050510' : '#001000'; // Dark Blue vs Matrix Dark
        ctx.fillRect(0,0, canvas.width, canvas.height);

        // Draw Rain (if volume > 0)
        // We always draw a bit, but opacity depends on volume
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1;
        
        particles.forEach(p => {
            // Visualize Audio: Rain volume controls opacity
            const opacity = vols.rain > 0 ? vols.rain : 0.1;
            ctx.globalAlpha = opacity;
            
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + p.l);
            ctx.stroke();

            // Move
            p.y += p.s + (vols.rain * 10); // Faster if louder
            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }
        });

        // Draw Drone "Pulse" (if drone volume > 0)
        if (vols.drone > 0) {
            ctx.globalAlpha = vols.drone * 0.2;
            const center = canvas.height / 2;
            ctx.fillStyle = '#0f0';
            ctx.fillRect(0, center - (vols.drone * 100), canvas.width, vols.drone * 200);
        }

        frameId = requestAnimationFrame(draw);
    }
    
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [vols, isNight]);

  return (
    <>
      <canvas ref={canvasRef} />
      
      {!started && (
        <div className="overlay">
          <button className="btn-main" onClick={startEngine}>
            Initialize Procedural Engine
          </button>
        </div>
      )}

      {started && (
        <div className="app-container">
          <div className="control-box">
            <h1>GENERATOR v1.0</h1>
            <div className="status-bar">
               MODE: {isNight ? "NIGHT (LOW FREQ)" : "DAY (HIGH FREQ)"}
            </div>

            <div className="slider-row">
              <span className="label">RAIN (PINK NOISE)</span>
              <input type="range" min="0" max="1" step="0.01" 
                     value={vols.rain} onChange={e => handleVol('rain', e.target.value)} />
            </div>

            <div className="slider-row">
              <span className="label">SYNTH (OSC)</span>
              <input type="range" min="0" max="0.5" step="0.01" 
                     value={vols.drone} onChange={e => handleVol('drone', e.target.value)} />
            </div>

            <div className="slider-row">
              <span className="label">RUMBLE (BROWN NOISE)</span>
              <input type="range" min="0" max="1" step="0.01" 
                     value={vols.rumble} onChange={e => handleVol('rumble', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
