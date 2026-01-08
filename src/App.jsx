import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [started, setStarted] = useState(false)
  const [timeMode, setTimeMode] = useState('day') // morning, day, evening, night
  const [vols, setVols] = useState({ rain: 0, drone: 0, rumble: 0 })

  const audioCtx = useRef(null)
  const nodes = useRef({}) 
  const canvasRef = useRef(null)

  // --- AUDIO GENERATORS ---
  const createPinkNoise = (ctx) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0; 
    
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; 
      b6 = white * 0.115926;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    return noise;
  }

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

    const rainGain = ctx.createGain(); rainGain.gain.value = 0;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0;
    const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;

    // 1. RAIN
    const rainSrc = createPinkNoise(ctx);
    rainSrc.connect(rainGain);
    rainGain.connect(ctx.destination);
    rainSrc.start(0);

    // 2. DRONE (Oscillators)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine'; 
    osc2.type = 'triangle'; 
    
    // DETERMINE FREQUENCY BASED ON TIME
    const hour = new Date().getHours();
    let baseFreq = 110; // Default A2
    let mode = 'day';

    if (hour >= 5 && hour < 12) {
        mode = 'morning';
        baseFreq = 146.83; // D3 (Hopeful/Bright)
    } else if (hour >= 12 && hour < 17) {
        mode = 'day';
        baseFreq = 110.00; // A2 (Active/Neutral)
    } else if (hour >= 17 && hour < 21) {
        mode = 'evening';
        baseFreq = 97.99; // G2 (Warm/Melancholy)
    } else {
        mode = 'night';
        baseFreq = 55.00; // A1 (Deep/Sleep)
    }
    
    setTimeMode(mode);

    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq + 2; // Slight detune for warmth
    
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 400; 

    osc1.connect(droneFilter);
    osc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);
    osc1.start(0);
    osc2.start(0);

    // 3. RUMBLE
    const rumbleSrc = createBrownNoise(ctx);
    rumbleSrc.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumbleSrc.start(0);

    nodes.current = { rain: rainGain, drone: droneGain, rumble: rumbleGain }
    setStarted(true)
  }

  const handleVol = (type, val) => {
    const v = parseFloat(val);
    setVols(prev => ({...prev, [type]: v}));
    if (audioCtx.current && nodes.current[type]) {
        nodes.current[type].gain.setTargetAtTime(v, audioCtx.current.currentTime, 0.1);
    }
  }

  // --- VISUALS ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for(let i=0; i<100; i++) particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        s: Math.random() * 2 + 0.5, 
        l: Math.random() * 20 + 5   
    });

    const draw = () => {
        // DYNAMIC BACKGROUND COLOR
        let bgColor = '#000';
        let rainColor = '#0f0'; // Default Matrix Green

        if (timeMode === 'morning') {
            bgColor = '#00151f'; // Deep Dawn Blue
            rainColor = '#00a8ff'; // Cyan Rain
        } else if (timeMode === 'day') {
            bgColor = '#001000'; // Matrix Dark
            rainColor = '#0f0'; // Retro Green
        } else if (timeMode === 'evening') {
            bgColor = '#1a0a00'; // Deep Sunset Rust
            rainColor = '#ff5500'; // Amber Rain
        } else {
            bgColor = '#050508'; // Void Black
            rainColor = '#444'; // Silver/Ghost Rain
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(0,0, canvas.width, canvas.height);

        // Draw Rain
        ctx.strokeStyle = rainColor;
        ctx.lineWidth = 1;
        
        particles.forEach(p => {
            const opacity = vols.rain > 0 ? vols.rain : 0.05;
            ctx.globalAlpha = opacity;
            
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + p.l);
            ctx.stroke();

            p.y += p.s + (vols.rain * 10);
            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }
        });

        // Draw Drone "Horizon" Line
        if (vols.drone > 0) {
            ctx.globalAlpha = vols.drone * 0.3;
            ctx.fillStyle = rainColor;
            // A glowing horizon line that gets thicker with volume
            const horizonY = canvas.height * 0.7;
            ctx.fillRect(0, horizonY, canvas.width, vols.drone * 50);
            
            // Reflection
            ctx.globalAlpha = vols.drone * 0.1;
            ctx.fillRect(0, horizonY + (vols.drone * 60), canvas.width, vols.drone * 20);
        }

        frameId = requestAnimationFrame(draw);
    }
    
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [vols, timeMode]);

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
            <h1>GENERATOR v1.1</h1>
            <div className="status-bar" style={{color: 
                timeMode === 'morning' ? '#00a8ff' : 
                timeMode === 'evening' ? '#ff5500' : 
                timeMode === 'night' ? '#888' : '#0f0'
            }}>
               CURRENT PHASE: {timeMode.toUpperCase()}
            </div>

            <div className="slider-row">
              <span className="label">RAIN</span>
              <input type="range" min="0" max="1" step="0.01" 
                     value={vols.rain} onChange={e => handleVol('rain', e.target.value)} />
            </div>

            <div className="slider-row">
              <span className="label">SYNTH</span>
              <input type="range" min="0" max="0.5" step="0.01" 
                     value={vols.drone} onChange={e => handleVol('drone', e.target.value)} />
            </div>

            <div className="slider-row">
              <span className="label">RUMBLE</span>
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
