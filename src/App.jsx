import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [started, setStarted] = useState(false)
  const [timeMode, setTimeMode] = useState('day') 
  
  // ADDED: beats and chords volume
  const [vols, setVols] = useState(() => {
    const saved = localStorage.getItem('lofi-vols')
    return saved ? JSON.parse(saved) : { rain: 0, drone: 0, rumble: 0, beats: 0, chords: 0 }
  })

  const audioCtx = useRef(null)
  const nodes = useRef({}) 
  const analyserRef = useRef(null) 
  const canvasRef = useRef(null)
  
  // SEQUENCER REFS
  const nextNoteTime = useRef(0)
  const current16thNote = useRef(0)
  const schedulerTimer = useRef(null)
  const tempo = 80 // Classic Lofi BPM

  useEffect(() => {
    localStorage.setItem('lofi-vols', JSON.stringify(vols))
  }, [vols])

  // --- 1. PROCEDURAL DRUM SYNTHESIS (No Samples!) ---
  const playKick = (ctx, time, vol) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(nodes.current.masterGain); // Connect to master

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  const playSnare = (ctx, time, vol) => {
    // 1. Tone (Triangle)
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const gainOsc = ctx.createGain();
    osc.connect(gainOsc);
    gainOsc.connect(nodes.current.masterGain);
    
    // 2. Noise (Snap)
    const bufferSize = ctx.sampleRate * 0.5; // 0.5 sec
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gainNoise = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    noise.connect(filter);
    filter.connect(gainNoise);
    gainNoise.connect(nodes.current.masterGain);

    // Envelope
    osc.frequency.setValueAtTime(250, time);
    gainOsc.gain.setValueAtTime(vol * 0.5, time);
    gainOsc.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    
    gainNoise.gain.setValueAtTime(vol * 0.8, time);
    gainNoise.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    osc.start(time);
    osc.stop(time + 0.2);
    noise.start(time);
    noise.stop(time + 0.2);
  }

  const playHiHat = (ctx, time, vol) => {
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000; // Sizzle
    
    const gain = ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(nodes.current.masterGain);

    gain.gain.setValueAtTime(vol * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    
    noise.start(time);
    noise.stop(time + 0.05);
  }

  // --- 2. LOFI CHORDS SYNTHESIS (Wobbly Electric Piano) ---
  const playChord = (ctx, time, vol, chordType) => {
    // Jazz Chords (Fmaj7, Em7, Dm9, Cmaj7) - Frequencies
    const chords = [
        [349.23, 440.00, 523.25, 659.25], // Fmaj7
        [329.63, 392.00, 493.88, 587.33], // Em7
        [293.66, 349.23, 440.00, 523.25], // Dm7
        [261.63, 329.63, 392.00, 493.88]  // Cmaj7
    ];
    
    const notes = chords[chordType % 4];

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // Soft sound
        
        // WARBLE (Lofi Detune)
        // We modulate the frequency slightly with a slow Sine wave
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 2; // 2Hz wobble
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 2; // +/- 2Hz depth
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(time);

        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(nodes.current.masterGain);

        // Soft Attack & Long Release
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol * 0.1, time + 0.1); // Attack
        gain.gain.exponentialRampToValueAtTime(0.01, time + 2.5); // Release

        osc.start(time);
        osc.stop(time + 3); // Let it ring
        lfo.stop(time + 3);
    });
  }

  // --- 3. THE SCHEDULER (The Brain) ---
  const scheduleNote = (beatNumber, time) => {
    // Current Rhythm Logic
    if (vols.beats > 0) {
        // Kick on 1 and "and of 3" (Classic HipHop)
        if (beatNumber === 0) playKick(audioCtx.current, time, vols.beats);
        if (beatNumber === 10) playKick(audioCtx.current, time, vols.beats);

        // Snare on 5 and 13 (Backbeat)
        if (beatNumber === 4 || beatNumber === 12) playSnare(audioCtx.current, time, vols.beats);

        // Hats every other beat with swing
        if (beatNumber % 2 === 0) playHiHat(audioCtx.current, time, vols.beats);
        else if (Math.random() > 0.5) playHiHat(audioCtx.current, time, vols.beats * 0.5); // Ghost notes
    }

    // Chords every 16 steps (1 bar)
    if (vols.chords > 0 && beatNumber === 0) {
        // Change chord every bar
        const barIndex = Math.floor(Date.now() / 2000); 
        playChord(audioCtx.current, time, vols.chords, barIndex);
    }
  }

  const scheduler = () => {
    // lookahead: 25ms. If note is due within 100ms, schedule it.
    while (nextNoteTime.current < audioCtx.current.currentTime + 0.1) {
        scheduleNote(current16thNote.current, nextNoteTime.current);
        
        // Advance Time
        const secondsPerBeat = 60.0 / tempo;
        // SWING LOGIC: Even 16ths are short, Odd are long
        const swing = 0.03; // Amount of "Drunk" feel
        const isSwing = current16thNote.current % 2 === 1;
        
        // 0.25 is a 16th note
        nextNoteTime.current += 0.25 * secondsPerBeat + (isSwing ? swing : 0);

        current16thNote.current = (current16thNote.current + 1) % 16;
    }
    schedulerTimer.current = requestAnimationFrame(scheduler);
  }

  // --- AUDIO INIT (Unchanged parts hidden for brevity, updated parts below) ---
  const startEngine = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    audioCtx.current = ctx

    // Master Gain for easy mixing
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);
    
    // Analyzer Setup
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    masterGain.connect(analyser) // Master goes to analyser
    analyserRef.current = analyser

    // Store globally
    nodes.current = { masterGain }

    // Start Ambient Layers (Rain/Drone/Rumble - reused from previous)
    startAmbientLayers(ctx, masterGain);

    // Start Sequencer
    nextNoteTime.current = ctx.currentTime + 0.1;
    scheduler();

    setStarted(true)
  }

  // Re-implemented Ambient Layers helper to keep code clean
  const startAmbientLayers = (ctx, dest) => {
    // 1. Rain
    const rainSrc = createPinkNoise(ctx);
    const rainGain = ctx.createGain(); rainGain.gain.value = vols.rain;
    rainSrc.connect(rainGain).connect(dest);
    rainSrc.start(0);

    // 2. Drone
    const osc1 = ctx.createOscillator(); osc1.type = 'sine';
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle';
    // Frequency Logic (Day/Night) - kept same
    const hour = new Date().getHours();
    let baseFreq = hour > 18 || hour < 6 ? 55 : 110; 
    osc1.frequency.value = baseFreq; osc2.frequency.value = baseFreq + 2;
    const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 400;
    const droneGain = ctx.createGain(); droneGain.gain.value = vols.drone;
    osc1.connect(droneFilter); osc2.connect(droneFilter);
    droneFilter.connect(droneGain).connect(dest);
    osc1.start(0); osc2.start(0);

    // 3. Rumble
    const rumbleSrc = createPinkNoise(ctx);
    const rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 350;
    const rumbleGain = ctx.createGain(); rumbleGain.gain.value = vols.rumble;
    rumbleSrc.connect(rumbleFilter).connect(rumbleGain).connect(dest);
    rumbleSrc.start(0);
    
    // Store gains
    nodes.current.rain = rainGain;
    nodes.current.drone = droneGain;
    nodes.current.rumble = rumbleGain;
  }

  // ... (Keep createPinkNoise function from previous step) ...
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

  // Volume Handler
  const handleVol = (type, val) => {
    const v = parseFloat(val);
    setVols(prev => ({...prev, [type]: v}));
    
    // If it's an ambient layer, update immediately
    if (audioCtx.current && nodes.current[type]) {
        nodes.current[type].gain.setTargetAtTime(v, audioCtx.current.currentTime, 0.1);
    }
    // Note: Beats/Chords use 'vols' state directly in the scheduler loop, so no node update needed here
  }

  const applyPreset = (p) => {
    if(p === 'focus') { handleVol('rain', 0.1); handleVol('drone', 0.1); handleVol('beats', 0.3); handleVol('chords', 0.2); }
    if(p === 'sleep') { handleVol('rain', 0.5); handleVol('drone', 0.1); handleVol('beats', 0.0); handleVol('chords', 0.0); }
    if(p === 'vibe')  { handleVol('rain', 0.1); handleVol('drone', 0.0); handleVol('beats', 0.6); handleVol('chords', 0.5); }
  }

  // ... (Keep the CANVAS VISUAL ENGINE from previous step EXACTLY AS IS) ...
  // For brevity, I am not repasting the 150 lines of Canvas code here, 
  // BUT YOU MUST KEEP IT in the final file.
  // I will just stub it out in this message so you know where it goes.
  
  // --- CANVAS VISUAL ENGINE STUB ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    
    // ... (PASTE YOUR PREVIOUS CANVAS CODE HERE: Stars, Clouds, Rain, Visualizer) ...
    // Make sure to add `vols.beats` or `vols.chords` to dependency array if you want visuals to react to them
    
    // Quick Fix for visualizer: ensure it uses the code from previous step
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const draw = () => {
        // ... (Previous Drawing Logic) ...
        // Clear
        ctx.fillStyle = '#000'; 
        if(timeMode === 'morning') ctx.fillStyle = '#0f172a';
        if(timeMode === 'day') ctx.fillStyle = '#1e293b';
        if(timeMode === 'evening') ctx.fillStyle = '#271a12';
        ctx.fillRect(0,0, canvas.width, canvas.height);

        // WAVEFORM (Visualizer) - This needs to run to see the music!
        if (analyserRef.current) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteTimeDomainData(dataArray);
            ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath();
            const sliceWidth = canvas.width / bufferLength; let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; const y = (v * (canvas.height/4)) + (canvas.height * 0.75);
                if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); x += sliceWidth;
            }
            ctx.stroke();
        }
        frameId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [vols, timeMode]); // End Canvas Stub


  return (
    <>
      <canvas ref={canvasRef} />
      
      {!started && (
        <div className="overlay">
          <button className="btn-start" onClick={startEngine}>
            Start Lofi Station
          </button>
        </div>
      )}

      {started && (
        <div className="app-container">
          <div className="control-box">
            <h1>Lofi Gen.</h1>
            <div className="subtitle">Phase: {timeMode} | BPM: {tempo}</div>

            <div className="preset-row">
                <button className="btn-preset" onClick={() => applyPreset('focus')}>Focus</button>
                <button className="btn-preset" onClick={() => applyPreset('sleep')}>Sleep</button>
                <button className="btn-preset" onClick={() => applyPreset('vibe')}>Vibe</button>
            </div>

            {/* AMBIENT SLIDERS */}
            <div className="slider-group">
              <div className="slider-label"><span>Rain</span><span>{(vols.rain * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="1" step="0.01" value={vols.rain} onChange={e => handleVol('rain', e.target.value)} />
            </div>

            <div className="slider-group">
              <div className="slider-label"><span>Drone</span><span>{(vols.drone * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="0.5" step="0.01" value={vols.drone} onChange={e => handleVol('drone', e.target.value)} />
            </div>

            {/* MUSIC SLIDERS (NEW) */}
            <div className="slider-group">
              <div className="slider-label" style={{color: '#00f0ff'}}><span>Lofi Beats</span><span>{(vols.beats * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="1" step="0.01" value={vols.beats} onChange={e => handleVol('beats', e.target.value)} />
            </div>

            <div className="slider-group">
              <div className="slider-label" style={{color: '#f0f'}}><span>Jazz Chords</span><span>{(vols.chords * 100).toFixed(0)}%</span></div>
              <input type="range" min="0" max="1" step="0.01" value={vols.chords} onChange={e => handleVol('chords', e.target.value)} />
            </div>

          </div>
        </div>
      )}
    </>
  )
}

export default App
