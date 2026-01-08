import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [started, setStarted] = useState(false)
  const [timeMode, setTimeMode] = useState('day') 
  
  const [vols, setVols] = useState(() => {
    try {
      const saved = localStorage.getItem('lofi-vols')
      const parsed = saved ? JSON.parse(saved) : {}
      return { 
        rain: parsed.rain || 0, 
        drone: parsed.drone || 0, 
        rumble: parsed.rumble || 0, 
        beats: parsed.beats || 0, 
        chords: parsed.chords || 0, 
        bass: parsed.bass || 0, 
        vinyl: parsed.vinyl || 0 
      }
    } catch (e) {
      return { rain: 0, drone: 0, rumble: 0, beats: 0, chords: 0, bass: 0, vinyl: 0 }
    }
  })

  // LIVE REFS (The Whiteboard)
  const volsRef = useRef(vols)
  
  const audioCtx = useRef(null)
  const nodes = useRef({}) 
  const analyserRef = useRef(null) 
  const canvasRef = useRef(null)
  
  const nextNoteTime = useRef(0)
  const current16thNote = useRef(0)
  const schedulerTimer = useRef(null)
  const tempo = 80 
  
  // NEW: DRIFT ENGINE REFS
  const barCount = useRef(0) // Count bars to trigger variations
  const driftOffset = useRef(0) // Slow drift for atmosphere

  useEffect(() => {
    volsRef.current = vols
    localStorage.setItem('lofi-vols', JSON.stringify(vols))
  }, [vols])

  // =========================================================
  // AUDIO HELPERS
  // =========================================================
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
    noise.buffer = buffer; noise.loop = true; return noise;
  }

  const createVinylCrackle = (ctx) => {
    const bufferSize = ctx.sampleRate * 2; 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        if (Math.random() > 0.999) data[i] = Math.random() * 0.5;
        else data[i] = 0;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer; noise.loop = true; return noise;
  }

  // =========================================================
  // INSTRUMENTS (With Humanization)
  // =========================================================
  const playKick = (ctx, time, vol) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(nodes.current.masterGain);
    
    // VARIATION: Slight pitch shift per hit
    const pitchVar = Math.random() * 10 - 5; 
    
    osc.frequency.setValueAtTime(150 + pitchVar, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    // VARIATION: Velocity Humanization
    const velVar = vol * (0.9 + Math.random() * 0.2); 
    
    gain.gain.setValueAtTime(velVar, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.start(time); osc.stop(time + 0.5);
  }

  const playSnare = (ctx, time, vol) => {
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    const gainOsc = ctx.createGain(); osc.connect(gainOsc); gainOsc.connect(nodes.current.masterGain);
    
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const gainNoise = ctx.createGain();
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 1000;
    noise.connect(filter); filter.connect(gainNoise); gainNoise.connect(nodes.current.masterGain);

    // VARIATION: Slight Snare Pitch Shift
    const pitchVar = Math.random() * 20 - 10;
    osc.frequency.setValueAtTime(250 + pitchVar, time);
    
    // VARIATION: Velocity
    const vel = vol * (0.8 + Math.random() * 0.3);

    gainOsc.gain.setValueAtTime(vel * 0.5, time);
    gainOsc.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    gainNoise.gain.setValueAtTime(vel * 0.8, time);
    gainNoise.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    osc.start(time); osc.stop(time + 0.2);
    noise.start(time); noise.stop(time + 0.2);
  }

  const playHiHat = (ctx, time, vol) => {
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    
    // VARIATION: Filter modulation (Open/Closed feel)
    const freqVar = 6000 + Math.random() * 2000;
    
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = freqVar;
    const gain = ctx.createGain();
    noise.connect(filter); filter.connect(gain); gain.connect(nodes.current.masterGain);
    
    // VARIATION: Human velocity
    const vel = vol * (0.5 + Math.random() * 0.5);
    
    gain.gain.setValueAtTime(vel * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noise.start(time); noise.stop(time + 0.05);
  }

  const playChord = (ctx, time, vol, chordIndex) => {
    const chords = [
        [349.23, 440.00, 523.25, 659.25], // Fmaj7
        [329.63, 392.00, 493.88, 587.33], // Em7
        [293.66, 349.23, 440.00, 523.25], // Dm7
        [261.63, 329.63, 392.00, 493.88]  // Cmaj7
    ];
    
    // VARIATION: Occasional Chord Substitution (Add a 9th or invert)
    // Every 8 bars, we shift the voicing up
    let notes = chords[chordIndex % 4];
    if (barCount.current % 8 === 7) {
        notes = notes.map(n => n * 1.5); // Shift to 5th/High voicing
    }

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; 
        
        const lfo = ctx.createOscillator(); lfo.frequency.value = 2; 
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 2; 
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start(time);

        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(nodes.current.masterGain);

        // VARIATION: Strumming (Delay each note slightly)
        const strumDelay = i * 0.05 + (Math.random() * 0.02);
        const startTime = time + strumDelay;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol * 0.1, startTime + 0.1); 
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 2.5); 

        osc.start(startTime); osc.stop(startTime + 3); lfo.stop(startTime + 3);
    });
  }

  const playBass = (ctx, time, vol, chordIndex) => {
    const roots = [87.31, 82.41, 73.42, 65.41]; 
    const freq = roots[chordIndex % 4];
    const osc = ctx.createOscillator(); osc.type = 'sine'; 
    const gain = ctx.createGain();
    
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(gain); gain.connect(nodes.current.masterGain);
    
    // VARIATION: Slide into note (Portamento)
    if (Math.random() > 0.7) {
        osc.frequency.setValueAtTime(freq - 10, time);
        osc.frequency.linearRampToValueAtTime(freq, time + 0.1);
    }
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol * 0.6, time + 0.1); 
    gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5); 
    osc.start(time); osc.stop(time + 1.6);
  }

  // =========================================================
  // ENGINE LOGIC
  // =========================================================
  const startAmbientLayers = (ctx, dest) => {
    // Rain
    const rainSrc = createPinkNoise(ctx);
    const rainGain = ctx.createGain(); rainGain.gain.value = volsRef.current.rain;
    rainSrc.connect(rainGain).connect(dest);
    rainSrc.start(0);

    // Drone
    const osc1 = ctx.createOscillator(); osc1.type = 'sine';
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle';
    const hour = new Date().getHours();
    let baseFreq = hour > 18 || hour < 6 ? 55 : 110; 
    osc1.frequency.value = baseFreq; osc2.frequency.value = baseFreq + 2;
    const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 400;
    const droneGain = ctx.createGain(); droneGain.gain.value = volsRef.current.drone;
    osc1.connect(droneFilter); osc2.connect(droneFilter);
    droneFilter.connect(droneGain).connect(dest);
    osc1.start(0); osc2.start(0);

    // Rumble
    const rumbleSrc = createPinkNoise(ctx);
    const rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 350;
    const rumbleGain = ctx.createGain(); rumbleGain.gain.value = volsRef.current.rumble;
    rumbleSrc.connect(rumbleFilter).connect(rumbleGain).connect(dest);
    rumbleSrc.start(0);

    // Vinyl
    const vinylSrc = createVinylCrackle(ctx);
    const vinylGain = ctx.createGain(); vinylGain.gain.value = volsRef.current.vinyl;
    const vinylFilter = ctx.createBiquadFilter(); vinylFilter.type = 'highpass'; vinylFilter.frequency.value = 2000;
    vinylSrc.connect(vinylFilter).connect(vinylGain).connect(dest);
    vinylSrc.start(0);
    
    nodes.current.rain = rainGain;
    nodes.current.drone = droneGain;
    nodes.current.rumble = rumbleGain;
    nodes.current.vinyl = vinylGain;
  }

  const scheduleNote = (beatNumber, time) => {
    const currentVols = volsRef.current;

    // VARIATION: Humanize Timing (Micro-offsets)
    // Randomly delay events by 0-15ms to simulate human imperfection
    const humanize = (Math.random() * 0.015);
    const humanTime = time + humanize;

    if (currentVols.beats > 0) {
        if (beatNumber === 0 || beatNumber === 10) playKick(audioCtx.current, humanTime, currentVols.beats);
        
        // VARIATION: Occasional Extra Kick
        if (beatNumber === 14 && Math.random() > 0.8) playKick(audioCtx.current, humanTime, currentVols.beats * 0.6);

        if (beatNumber === 4 || beatNumber === 12) playSnare(audioCtx.current, humanTime, currentVols.beats);
        
        // VARIATION: Ghost Snares
        if (beatNumber === 7 && Math.random() > 0.7) playSnare(audioCtx.current, humanTime, currentVols.beats * 0.3);

        if (beatNumber % 2 === 0) playHiHat(audioCtx.current, humanTime, currentVols.beats);
        else if (Math.random() > 0.5) playHiHat(audioCtx.current, humanTime, currentVols.beats * 0.5); 
    }

    if (beatNumber === 0) {
        barCount.current++;
        // Use barCount to drive Chord Progression
        const chordIndex = barCount.current; 
        
        if (currentVols.chords > 0) playChord(audioCtx.current, humanTime, currentVols.chords, chordIndex);
        if (currentVols.bass > 0) playBass(audioCtx.current, humanTime, currentVols.bass, chordIndex);
    }
  }

  const scheduler = () => {
    while (nextNoteTime.current < audioCtx.current.currentTime + 0.1) {
        scheduleNote(current16thNote.current, nextNoteTime.current);
        const secondsPerBeat = 60.0 / tempo;
        const swing = 0.03; 
        const isSwing = current16thNote.current % 2 === 1;
        nextNoteTime.current += 0.25 * secondsPerBeat + (isSwing ? swing : 0);
        current16thNote.current = (current16thNote.current + 1) % 16;
    }

    // VARIATION: DYNAMIC LAYERING (Slow Breath)
    // Slowly modulate drone volume up/down to make it feel alive
    if (nodes.current.drone) {
        driftOffset.current += 0.001;
        const drift = Math.sin(driftOffset.current) * 0.1; // +/- 10%
        // Apply modulated volume (Original Setting + Drift)
        const baseVol = volsRef.current.drone;
        if(baseVol > 0) {
           nodes.current.drone.gain.setTargetAtTime(Math.max(0, baseVol + drift), audioCtx.current.currentTime, 0.1);
        }
    }

    schedulerTimer.current = requestAnimationFrame(scheduler);
  }

  const startEngine = () => {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        const ctx = new Ctx()
        audioCtx.current = ctx
        const masterGain = ctx.createGain(); masterGain.gain.value = 1.0; masterGain.connect(ctx.destination);
        const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; masterGain.connect(analyser); analyserRef.current = analyser;
        nodes.current = { masterGain }
        startAmbientLayers(ctx, masterGain);
        nextNoteTime.current = ctx.currentTime + 0.1;
        scheduler();
        setStarted(true)
    } catch (err) {
        console.error("Audio Engine Start Failed:", err)
        alert("Audio Engine Failed. Please refresh.")
    }
  }

  const handleVol = (type, val) => {
    const v = parseFloat(val);
    setVols(prev => ({...prev, [type]: v}));
    // Direct update for continuous sounds
    if (audioCtx.current && nodes.current[type]) {
        nodes.current[type].gain.setTargetAtTime(v, audioCtx.current.currentTime, 0.1);
    }
  }

  const applyPreset = (p) => {
    if(p === 'focus') { handleVol('rain', 0.1); handleVol('drone', 0.1); handleVol('beats', 0.4); handleVol('chords', 0.2); handleVol('bass', 0.2); handleVol('vinyl', 0.1); handleVol('rumble', 0.0); }
    if(p === 'sleep') { handleVol('rain', 0.5); handleVol('drone', 0.1); handleVol('beats', 0.0); handleVol('chords', 0.0); handleVol('bass', 0.0); handleVol('vinyl', 0.05); handleVol('rumble', 0.4); }
    if(p === 'vibe')  { handleVol('rain', 0.1); handleVol('drone', 0.0); handleVol('beats', 0.6); handleVol('chords', 0.5); handleVol('bass', 0.5); handleVol('vinyl', 0.2); handleVol('rumble', 0.0); }
    if(p === 'storm') { handleVol('rain', 0.8); handleVol('drone', 0.0); handleVol('beats', 0.0); handleVol('chords', 0.0); handleVol('bass', 0.0); handleVol('vinyl', 0.0); handleVol('rumble', 0.6); }
  }

  // =========================================================
  // VISUAL ENGINE
  // =========================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    let lightningTimer = 0;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const rainParticles = [];
    for(let i=0; i<100; i++) rainParticles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 2 + 0.5, l: Math.random() * 20 + 5 });
    const stars = [];
    for(let i=0; i<150; i++) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 1.5, blinkSpeed: Math.random() * 0.05, offset: Math.random() * Math.PI });
    const clouds = [];
    for(let i=0; i<5; i++) clouds.push({ x: Math.random() * canvas.width, y: (Math.random() * canvas.height) * 0.5, speed: (Math.random() * 0.2) + 0.1, size: (Math.random() * 50) + 50, puffs: 5 });
    let shootingStar = null; 

    const draw = () => {
        let bgColor = '#000'; let accent = '#fff'; let sunColor = '#fff'; let isDay = false;
        const hour = new Date().getHours();
        let mode = 'day';
        if (hour >= 5 && hour < 12) { mode = 'morning'; }
        else if (hour >= 12 && hour < 17) { mode = 'day'; }
        else if (hour >= 17 && hour < 21) { mode = 'evening'; }
        else { mode = 'night'; }
        if (timeMode !== mode) setTimeMode(mode);

        if (mode === 'morning') { bgColor = '#0f172a'; accent = '#38bdf8'; sunColor = '#fcd34d'; isDay = true; } 
        else if (mode === 'day') { bgColor = '#1e293b'; accent = '#a5b4fc'; sunColor = '#fdba74'; isDay = true; } 
        else if (mode === 'evening') { bgColor = '#271a12'; accent = '#fb923c'; sunColor = '#ea580c'; isDay = false; } 
        else { bgColor = '#020205'; accent = '#94a3b8'; sunColor = '#f8fafc'; isDay = false; }

        ctx.fillStyle = bgColor; ctx.fillRect(0,0, canvas.width, canvas.height);

        if (vols.rumble > 0.5) {
            if (Math.random() < 0.005 * (vols.rumble * 2)) lightningTimer = 5;
        }
        if (lightningTimer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${lightningTimer * 0.1})`; ctx.fillRect(0, 0, canvas.width, canvas.height); lightningTimer--;
        }

        ctx.shadowBlur = 50; ctx.shadowColor = sunColor; ctx.fillStyle = sunColor; ctx.beginPath();
        const sunY = mode === 'morning' ? canvas.height*0.2 : mode === 'day' ? canvas.height*0.1 : canvas.height*0.15;
        ctx.arc(canvas.width * 0.8, sunY, 40, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

        if (isDay || mode === 'evening') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            clouds.forEach(c => {
                for(let j=0; j<c.puffs; j++) { ctx.beginPath(); ctx.arc(c.x + (j*30), c.y + (Math.sin(j)*10), c.size, 0, Math.PI*2); ctx.fill(); }
                c.x += c.speed; if(c.x > canvas.width + 100) c.x = -200;
            });
        }

        if (!isDay || mode === 'evening') {
            ctx.fillStyle = 'white';
            stars.forEach(s => {
                const opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.002 + s.offset)) * 0.7;
                ctx.globalAlpha = opacity; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1.0;
            if (!shootingStar && Math.random() < 0.005) shootingStar = { x: Math.random()*canvas.width, y: Math.random()*(canvas.height/2), vx: 15, vy: 2, len: 0 };
            if(shootingStar) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(shootingStar.x, shootingStar.y);
                ctx.lineTo(shootingStar.x - shootingStar.len, shootingStar.y - (shootingStar.len * 0.2)); ctx.stroke();
                shootingStar.x += shootingStar.vx; shootingStar.y += shootingStar.vy; shootingStar.len += 2;
                if (shootingStar.x > canvas.width + 200) shootingStar = null;
            }
        }

        if (analyserRef.current) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteTimeDomainData(dataArray);
            ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.beginPath();
            const sliceWidth = canvas.width / bufferLength; let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; const y = (v * (canvas.height/4)) + (canvas.height * 0.75);
                if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); x += sliceWidth;
            }
            ctx.stroke();
        }

        ctx.strokeStyle = accent; ctx.lineWidth = 1;
        rainParticles.forEach(p => {
            const opacity = vols.rain > 0 ? vols.rain * 0.5 : 0;
            ctx.globalAlpha = opacity; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.l); ctx.stroke();
            p.y += p.s + (vols.rain * 15); if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        });

        frameId = requestAnimationFrame(draw);
    }
    
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [vols, timeMode]);

  return (
    <>
      <canvas ref={canvasRef} />
      {!started && ( <div className="overlay"><button className="btn-start" onClick={startEngine}>Start Lofi Station</button></div> )}
      {started && (
        <div className="app-container">
          <div className="control-box">
            <h1>Lofi Gen.</h1>
            <div className="subtitle">Phase: {timeMode} | BPM: {tempo}</div>
            
            <div className="preset-row">
                <button className="btn-preset" onClick={() => applyPreset('focus')}>Focus</button>
                <button className="btn-preset" onClick={() => applyPreset('sleep')}>Sleep</button>
                <button className="btn-preset" onClick={() => applyPreset('vibe')}>Vibe</button>
                <button className="btn-preset" onClick={() => applyPreset('storm')}>Storm</button>
            </div>

            <div className="slider-group"> <div className="slider-label"><span>Rain</span><span>{(vols.rain * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.rain} onChange={e => handleVol('rain', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label"><span>Vinyl Crackle</span><span>{(vols.vinyl * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.vinyl} onChange={e => handleVol('vinyl', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label" style={{color: '#00f0ff'}}><span>Lofi Beats</span><span>{(vols.beats * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.beats} onChange={e => handleVol('beats', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label" style={{color: '#f0f'}}><span>Jazz Chords</span><span>{(vols.chords * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.chords} onChange={e => handleVol('chords', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label" style={{color: '#ffaa00'}}><span>Warm Bass</span><span>{(vols.bass * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.bass} onChange={e => handleVol('bass', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label"><span>Deep Rumble</span><span>{(vols.rumble * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.rumble} onChange={e => handleVol('rumble', e.target.value)} /> </div>

          </div>
        </div>
      )}
    </>
  )
}

export default App
