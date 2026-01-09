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
        vinyl: parsed.vinyl || 0,
        fire: parsed.fire || 0,
        thunder: parsed.thunder || 0
      }
    } catch (e) {
      return { rain: 0, drone: 0, rumble: 0, beats: 0, chords: 0, bass: 0, vinyl: 0, fire: 0, thunder: 0 }
    }
  })

  const volsRef = useRef(vols)
  const audioCtx = useRef(null)
  const nodes = useRef({}) 
  const analyserRef = useRef(null) 
  const canvasRef = useRef(null)
  
  const nextNoteTime = useRef(0)
  const current16thNote = useRef(0)
  const schedulerTimer = useRef(null)
  const tempo = 80 
  const barCount = useRef(0) 
  const driftOffset = useRef(0) 
  const lightningTrigger = useRef(0)

  useEffect(() => {
    volsRef.current = vols
    localStorage.setItem('lofi-vols', JSON.stringify(vols))
  }, [vols])

  // =========================================================
  // AUDIO DSP HELPERS (The "Lofi" Magic)
  // =========================================================
  
  // 1. SOFT CLIPPER (Saturation Curve)
  // This creates that "Warm Analog Tape" distortion
  const makeDistortionCurve = (amount) => {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

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

  const createFireSound = (ctx) => {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
         if(Math.random() > 0.95) data[i] = Math.random() * 0.3;
         else data[i] = Math.random() * 0.02; 
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer; noise.loop = true; return noise;
  }

  const triggerThunder = (ctx, vol) => {
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 200;
      const bufferSize = ctx.sampleRate * 1; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buffer;
      noise.connect(filter); filter.connect(gain); gain.connect(nodes.current.mixer);
      const time = ctx.currentTime;
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 2.5); 
      noise.start(time);
      lightningTrigger.current = 10; 
  }

  // =========================================================
  // INSTRUMENTS
  // =========================================================
  const playKick = (ctx, time, vol) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Connect to MIXER (which goes to Master Chain)
    osc.connect(gain); gain.connect(nodes.current.mixer);
    const pitchVar = Math.random() * 10 - 5; 
    osc.frequency.setValueAtTime(150 + pitchVar, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    const velVar = vol * (0.9 + Math.random() * 0.2); 
    gain.gain.setValueAtTime(velVar, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.start(time); osc.stop(time + 0.5);
  }

  const playSnare = (ctx, time, vol) => {
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    const gainOsc = ctx.createGain(); osc.connect(gainOsc); gainOsc.connect(nodes.current.mixer);
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const gainNoise = ctx.createGain();
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 1000;
    noise.connect(filter); filter.connect(gainNoise); gainNoise.connect(nodes.current.mixer);
    const pitchVar = Math.random() * 20 - 10;
    osc.frequency.setValueAtTime(250 + pitchVar, time);
    const vel = vol * (0.8 + Math.random() * 0.3);
    gainOsc.gain.setValueAtTime(vel * 0.5, time); gainOsc.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    gainNoise.gain.setValueAtTime(vel * 0.8, time); gainNoise.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.start(time); osc.stop(time + 0.2); noise.start(time); noise.stop(time + 0.2);
  }

  const playHiHat = (ctx, time, vol) => {
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const freqVar = 6000 + Math.random() * 2000;
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = freqVar;
    const gain = ctx.createGain();
    noise.connect(filter); filter.connect(gain); gain.connect(nodes.current.mixer);
    const vel = vol * (0.5 + Math.random() * 0.5);
    gain.gain.setValueAtTime(vel * 0.6, time); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noise.start(time); noise.stop(time + 0.05);
  }

  const playChord = (ctx, time, vol, chordIndex) => {
    const chords = [
        [349.23, 440.00, 523.25, 659.25], [329.63, 392.00, 493.88, 587.33], 
        [293.66, 349.23, 440.00, 523.25], [261.63, 329.63, 392.00, 493.88]  
    ];
    let notes = chords[chordIndex % 4];
    if (barCount.current % 8 === 7) notes = notes.map(n => n * 1.5); 
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'triangle'; 
        const lfo = ctx.createOscillator(); lfo.frequency.value = 2; 
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 2; 
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start(time);
        osc.frequency.value = freq; osc.connect(gain); gain.connect(nodes.current.mixer);
        const strumDelay = i * 0.05 + (Math.random() * 0.02); const startTime = time + strumDelay;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol * 0.1, startTime + 0.1); 
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 2.5); 
        osc.start(startTime); osc.stop(startTime + 3); lfo.stop(startTime + 3);
    });
  }

  const playBass = (ctx, time, vol, chordIndex) => {
    const roots = [87.31, 82.41, 73.42, 65.41]; const freq = roots[chordIndex % 4];
    const osc = ctx.createOscillator(); osc.type = 'sine'; const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, time); osc.connect(gain); gain.connect(nodes.current.mixer);
    if (Math.random() > 0.7) { osc.frequency.setValueAtTime(freq - 10, time); osc.frequency.linearRampToValueAtTime(freq, time + 0.1); }
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(vol * 0.6, time + 0.1); 
    gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5); osc.start(time); osc.stop(time + 1.6);
  }

  // =========================================================
  // ENGINE LOGIC
  // =========================================================
  const startAmbientLayers = (ctx, dest) => {
    // 1. Rain
    const rainSrc = createPinkNoise(ctx);
    const rainGain = ctx.createGain(); rainGain.gain.value = volsRef.current.rain;
    rainSrc.connect(rainGain).connect(dest);
    rainSrc.start(0);

    // 2. Drone
    const osc1 = ctx.createOscillator(); osc1.type = 'sine';
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle';
    const hour = new Date().getHours();
    let baseFreq = hour > 18 || hour < 6 ? 55 : 110; 
    osc1.frequency.value = baseFreq; osc2.frequency.value = baseFreq + 2;
    const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 400;
    const droneGain = ctx.createGain(); droneGain.gain.value = volsRef.current.drone;
    osc1.connect(droneFilter); osc2.connect(droneFilter); droneFilter.connect(droneGain).connect(dest);
    osc1.start(0); osc2.start(0);

    // 3. Rumble
    const rumbleSrc = createPinkNoise(ctx);
    const rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 350;
    const rumbleGain = ctx.createGain(); rumbleGain.gain.value = volsRef.current.rumble;
    rumbleSrc.connect(rumbleFilter).connect(rumbleGain).connect(dest);
    rumbleSrc.start(0);

    // 4. Vinyl
    const vinylSrc = createVinylCrackle(ctx);
    const vinylGain = ctx.createGain(); vinylGain.gain.value = volsRef.current.vinyl;
    const vinylFilter = ctx.createBiquadFilter(); vinylFilter.type = 'highpass'; vinylFilter.frequency.value = 2000;
    vinylSrc.connect(vinylFilter).connect(vinylGain).connect(dest);
    vinylSrc.start(0);
    
    // 5. Fire
    const fireSrc = createFireSound(ctx);
    const fireGain = ctx.createGain(); fireGain.gain.value = volsRef.current.fire;
    const fireFilter = ctx.createBiquadFilter(); fireFilter.type = 'lowpass'; fireFilter.frequency.value = 3000; 
    fireSrc.connect(fireFilter).connect(fireGain).connect(dest);
    fireSrc.start(0);

    nodes.current.rain = rainGain; nodes.current.drone = droneGain;
    nodes.current.rumble = rumbleGain; nodes.current.vinyl = vinylGain; nodes.current.fire = fireGain;
  }

  const scheduleNote = (beatNumber, time) => {
    const currentVols = volsRef.current;
    const humanize = (Math.random() * 0.015);
    const humanTime = time + humanize;
    const currentBar = barCount.current;
    const patternType = Math.floor(currentBar / 4) % 3;
    
    if (currentVols.thunder > 0 && Math.random() < 0.01) triggerThunder(audioCtx.current, currentVols.thunder);

    if (currentVols.beats > 0) {
        if (patternType === 0) {
            if (beatNumber === 0 || beatNumber === 10) playKick(audioCtx.current, humanTime, currentVols.beats);
            if (beatNumber === 4 || beatNumber === 12) playSnare(audioCtx.current, humanTime, currentVols.beats);
            if (beatNumber % 2 === 0) playHiHat(audioCtx.current, humanTime, currentVols.beats);
        } else if (patternType === 1) {
             if (beatNumber === 0 || beatNumber === 7 || beatNumber === 10) playKick(audioCtx.current, humanTime, currentVols.beats);
             if (beatNumber === 4 || beatNumber === 12) playSnare(audioCtx.current, humanTime, currentVols.beats);
             if (beatNumber % 2 === 0) playHiHat(audioCtx.current, humanTime, currentVols.beats);
        } else {
             if (beatNumber === 0) playKick(audioCtx.current, humanTime, currentVols.beats);
             if (beatNumber === 4) playSnare(audioCtx.current, humanTime, currentVols.beats); 
             if (Math.random() > 0.3) playHiHat(audioCtx.current, humanTime, currentVols.beats * 0.7);
        }
        if (currentBar % 4 === 3 && beatNumber > 12) playSnare(audioCtx.current, humanTime, currentVols.beats * 0.6); 
    }

    if (beatNumber === 0) {
        barCount.current++;
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
    if (nodes.current.drone) {
        driftOffset.current += 0.001;
        const baseVol = volsRef.current.drone;
        if(baseVol > 0) nodes.current.drone.gain.setTargetAtTime(Math.max(0, baseVol + Math.sin(driftOffset.current) * 0.1), audioCtx.current.currentTime, 0.1);
    }
    schedulerTimer.current = requestAnimationFrame(scheduler);
  }

  const startEngine = () => {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        const ctx = new Ctx()
        audioCtx.current = ctx

        // --- MASTERING CHAIN START ---
        
        // 1. Mixer (Everything connects here)
        const mixer = ctx.createGain(); 
        nodes.current.mixer = mixer;

        // 2. Soft Clipper (Saturation)
        const distortion = ctx.createWaveShaper();
        distortion.curve = makeDistortionCurve(50); // Amount of warmth
        distortion.oversample = '4x';

        // 3. Compressor (Glue)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        // 4. Analyser (Visuals)
        const analyser = ctx.createAnalyser(); 
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        // Route: Mixer -> Distortion -> Compressor -> Analyser -> Speakers
        mixer.connect(distortion);
        distortion.connect(compressor);
        compressor.connect(analyser);
        analyser.connect(ctx.destination);
        
        // --- MASTERING CHAIN END ---

        startAmbientLayers(ctx, mixer); // Pass Mixer, not Dest
        nextNoteTime.current = ctx.currentTime + 0.1;
        scheduler();
        setStarted(true)
    } catch (err) {
        alert("Audio Engine Failed. Refresh.")
    }
  }

  const handleVol = (type, val) => {
    const v = parseFloat(val);
    setVols(prev => ({...prev, [type]: v}));
    if (audioCtx.current && nodes.current[type]) {
        nodes.current[type].gain.setTargetAtTime(v, audioCtx.current.currentTime, 0.1);
    }
  }

  const applyPreset = (p) => {
    if(p === 'focus') { handleVol('rain', 0.1); handleVol('drone', 0.1); handleVol('beats', 0.4); handleVol('chords', 0.2); handleVol('bass', 0.2); handleVol('vinyl', 0.1); handleVol('rumble', 0.0); handleVol('fire', 0.0); handleVol('thunder', 0.0); }
    if(p === 'sleep') { handleVol('rain', 0.5); handleVol('drone', 0.1); handleVol('beats', 0.0); handleVol('chords', 0.0); handleVol('bass', 0.0); handleVol('vinyl', 0.05); handleVol('rumble', 0.4); handleVol('fire', 0.2); handleVol('thunder', 0.1); }
    if(p === 'vibe')  { handleVol('rain', 0.1); handleVol('drone', 0.0); handleVol('beats', 0.6); handleVol('chords', 0.5); handleVol('bass', 0.5); handleVol('vinyl', 0.2); handleVol('rumble', 0.0); handleVol('fire', 0.0); handleVol('thunder', 0.0); }
    if(p === 'storm') { handleVol('rain', 0.8); handleVol('drone', 0.0); handleVol('beats', 0.0); handleVol('chords', 0.0); handleVol('bass', 0.0); handleVol('vinyl', 0.0); handleVol('rumble', 0.6); handleVol('fire', 0.0); handleVol('thunder', 0.8); }
  }

  // =========================================================
  // VISUAL ENGINE
  // =========================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const rainParticles = [];
    for(let i=0; i<100; i++) rainParticles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 2 + 0.5, l: Math.random() * 20 + 5 });
    const stars = [];
    for(let i=0; i<150; i++) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 1.5, blinkSpeed: Math.random() * 0.05, offset: Math.random() * Math.PI });
    const clouds = [];
    for(let i=0; i<5; i++) clouds.push({ x: Math.random() * canvas.width, y: (Math.random() * canvas.height) * 0.5, speed: (Math.random() * 0.2) + 0.1, size: (Math.random() * 50) + 50, puffs: 5 });
    const fireParticles = [];
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

        if (lightningTrigger.current > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${lightningTrigger.current * 0.1})`; 
            ctx.fillRect(0, 0, canvas.width, canvas.height); 
            lightningTrigger.current--;
        }

        if (vols.fire > 0) {
            if (Math.random() < vols.fire) {
                fireParticles.push({ x: Math.random() * canvas.width, y: canvas.height + 10, size: Math.random() * 10 + 5, speed: Math.random() * 3 + 1, life: 1.0 });
            }
            fireParticles.forEach((p, i) => {
                ctx.fillStyle = `rgba(255, 100, 0, ${p.life})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                p.y -= p.speed; p.life -= 0.01; p.x += Math.sin(p.y * 0.1) * 0.5;
                if (p.life <= 0) fireParticles.splice(i, 1);
            });
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
            <div className="slider-group"> <div className="slider-label"><span>Fire Crackle</span><span>{(vols.fire * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.fire} onChange={e => handleVol('fire', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label"><span>Thunder</span><span>{(vols.thunder * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.thunder} onChange={e => handleVol('thunder', e.target.value)} /> </div>
            
            <div className="slider-group"> <div className="slider-label" style={{color: '#00f0ff'}}><span>Lofi Beats</span><span>{(vols.beats * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.beats} onChange={e => handleVol('beats', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label" style={{color: '#f0f'}}><span>Jazz Chords</span><span>{(vols.chords * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.chords} onChange={e => handleVol('chords', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label" style={{color: '#ffaa00'}}><span>Warm Bass</span><span>{(vols.bass * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.bass} onChange={e => handleVol('bass', e.target.value)} /> </div>
            <div className="slider-group"> <div className="slider-label"><span>Rumble & Vinyl</span><span>{(vols.rumble * 100).toFixed(0)}%</span></div> <input type="range" min="0" max="1" step="0.01" value={vols.rumble} onChange={e => {handleVol('rumble', e.target.value); handleVol('vinyl', e.target.value); }} /> </div>

          </div>
        </div>
      )}
    </>
  )
}

export default App
