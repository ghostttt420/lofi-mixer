import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [started, setStarted] = useState(false)
  const [timeMode, setTimeMode] = useState('day') 
  const [vols, setVols] = useState({ rain: 0, drone: 0, rumble: 0 })

  const audioCtx = useRef(null)
  const nodes = useRef({}) 
  const analyserRef = useRef(null) 
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

  const startEngine = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    audioCtx.current = ctx

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.connect(ctx.destination)
    analyserRef.current = analyser

    const rainGain = ctx.createGain(); rainGain.gain.value = 0;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0;
    const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;

    rainGain.connect(analyser)
    droneGain.connect(analyser)
    rumbleGain.connect(analyser)

    const rainSrc = createPinkNoise(ctx);
    rainSrc.connect(rainGain);
    rainSrc.start(0);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine'; osc2.type = 'triangle'; 
    
    // Time Logic
    const hour = new Date().getHours();
    let baseFreq = 110; 
    let mode = 'day';

    if (hour >= 5 && hour < 12) { mode = 'morning'; baseFreq = 146.83; }
    else if (hour >= 12 && hour < 17) { mode = 'day'; baseFreq = 110.00; }
    else if (hour >= 17 && hour < 21) { mode = 'evening'; baseFreq = 97.99; }
    else { mode = 'night'; baseFreq = 55.00; }
    
    setTimeMode(mode);
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq + 2; 
    
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass'; droneFilter.frequency.value = 400; 
    
    osc1.connect(droneFilter); osc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    osc1.start(0); osc2.start(0);

    const rumbleSrc = createBrownNoise(ctx);
    rumbleSrc.connect(rumbleGain);
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

  const applyPreset = (p) => {
    if(p === 'focus') { handleVol('rain', 0.2); handleVol('drone', 0.1); handleVol('rumble', 0.0); }
    if(p === 'sleep') { handleVol('rain', 0.5); handleVol('drone', 0.05); handleVol('rumble', 0.4); }
    if(p === 'storm') { handleVol('rain', 0.8); handleVol('drone', 0.0); handleVol('rumble', 0.6); }
  }

  // CANVAS ENGINE
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- PARTICLE SYSTEMS ---
    const particles = []; // Rain
    for(let i=0; i<100; i++) particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        s: Math.random() * 2 + 0.5, 
        l: Math.random() * 20 + 5   
    });

    const stars = []; // Static Stars
    for(let i=0; i<150; i++) stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5,
        blinkSpeed: Math.random() * 0.05,
        offset: Math.random() * Math.PI
    });

    let shootingStar = null; // One active shooting star at a time

    const draw = () => {
        let bgColor = '#000';
        let accent = '#fff';

        // Gradients based on time
        if (timeMode === 'morning') { bgColor = '#0f172a'; accent = '#38bdf8'; } 
        else if (timeMode === 'day') { bgColor = '#1e293b'; accent = '#a5b4fc'; } 
        else if (timeMode === 'evening') { bgColor = '#271a12'; accent = '#fb923c'; } 
        else { bgColor = '#020205'; accent = '#94a3b8'; } // Darker void for night

        // Clear
        ctx.fillStyle = bgColor;
        ctx.fillRect(0,0, canvas.width, canvas.height);

        // 1. DRAW STARS (Only Night/Evening)
        if (timeMode === 'night' || timeMode === 'evening') {
            ctx.fillStyle = 'white';
            stars.forEach(star => {
                // Twinkle Math
                const opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.002 + star.offset)) * 0.7;
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI*2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            // SHOOTING STAR LOGIC
            if (!shootingStar) {
                // 0.5% chance per frame to spawn a shooting star
                if (Math.random() < 0.005) {
                    shootingStar = {
                        x: Math.random() * canvas.width,
                        y: Math.random() * (canvas.height / 2),
                        vx: (Math.random() * 10) + 5, // velocity X
                        vy: (Math.random() * 2) + 1,  // velocity Y
                        len: 0
                    };
                }
            } else {
                // Draw Shooting Star
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(shootingStar.x, shootingStar.y);
                ctx.lineTo(shootingStar.x - shootingStar.len, shootingStar.y - (shootingStar.len * 0.2));
                ctx.stroke();

                // Move it
                shootingStar.x += shootingStar.vx;
                shootingStar.y += shootingStar.vy;
                shootingStar.len += 2; // Tail grows

                // Despawn if off screen
                if (shootingStar.x > canvas.width + 100) shootingStar = null;
            }
        }

        // 2. WAVEFORM
        if (analyserRef.current) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteTimeDomainData(dataArray);

            ctx.lineWidth = 2;
            ctx.strokeStyle = accent;
            ctx.beginPath();
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;

            for(let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; 
                const y = (v * (canvas.height/4)) + (canvas.height * 0.75);

                if(i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
        }

        // 3. DRAW RAIN
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        particles.forEach(p => {
            const opacity = vols.rain > 0 ? vols.rain * 0.5 : 0;
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + p.l);
            ctx.stroke();

            p.y += p.s + (vols.rain * 15);
            if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        });

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
          <button className="btn-start" onClick={startEngine}>
            Start Soundscape
          </button>
        </div>
      )}

      {started && (
        <div className="app-container">
          <div className="control-box">
            <h1>Lofi Gen.</h1>
            <div className="subtitle">Current Phase: {timeMode}</div>

            <div className="preset-row">
                <button className="btn-preset" onClick={() => applyPreset('focus')}>Focus</button>
                <button className="btn-preset" onClick={() => applyPreset('sleep')}>Sleep</button>
                <button className="btn-preset" onClick={() => applyPreset('storm')}>Storm</button>
            </div>

            <div className="slider-group">
              <div className="slider-label"><span>Rain Texture</span><span>{(vols.rain * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="1" step="0.01" value={vols.rain} onChange={e => handleVol('rain', e.target.value)} />
            </div>

            <div className="slider-group">
              <div className="slider-label"><span>Synth Drone</span><span>{(vols.drone * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="0.5" step="0.01" value={vols.drone} onChange={e => handleVol('drone', e.target.value)} />
            </div>

            <div className="slider-group">
              <div className="slider-label"><span>Deep Rumble</span><span>{(vols.rumble * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="1" step="0.01" value={vols.rumble} onChange={e => handleVol('rumble', e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
