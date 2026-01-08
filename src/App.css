import { useState, useEffect, useRef } from 'react'
import './App.css'

// 1. ASSETS: Using reliable MP3/WAV links
const SOUND_SOURCES = [
  { id: 'rain', name: 'RAIN', url: 'https://cdn.pixabay.com/audio/2022/07/04/audio_306283b7e7.mp3' }, 
  { id: 'thunder', name: 'STORM', url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_03d6f35b26.mp3' },
  { id: 'city', name: 'CITY', url: 'https://cdn.pixabay.com/audio/2021/09/06/audio_0c946f0470.mp3' }, // Ambient City
  { id: 'music', name: 'SYNTH', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3' } // Lofi Keys
]

function App() {
  const [started, setStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [volumes, setVolumes] = useState({ rain: 0.5, thunder: 0, city: 0, music: 0 }) // Start with Rain at 50%
  
  // Refs for Web Audio API
  const audioCtxRef = useRef(null)
  const sourcesRef = useRef({})
  const gainsRef = useRef({})
  const buffersRef = useRef({})

  // Refs for Canvas
  const canvasRef = useRef(null)

  // --- 1. WEB AUDIO API INITIALIZATION ---
  const initAudio = async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioCtxRef.current = new Ctx()
    
    let loadedCount = 0
    
    // Load all sounds into memory buffers
    for (let sound of SOUND_SOURCES) {
      try {
        const response = await fetch(sound.url)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer)
        buffersRef.current[sound.id] = audioBuffer
        
        loadedCount++
        setLoadProgress((loadedCount / SOUND_SOURCES.length) * 100)
      } catch (err) {
        console.error("Failed to load sound:", sound.id, err)
      }
    }
    setLoading(false)
  }

  // --- 2. START ENGINE (Triggered by user click) ---
  const startExperience = () => {
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    
    // Create Source Nodes & Loop them
    SOUND_SOURCES.forEach(sound => {
      const ctx = audioCtxRef.current
      const buffer = buffersRef.current[sound.id]
      
      if (buffer) {
        // Create Source (The Player)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        
        // Create Gain (The Volume Knob)
        const gainNode = ctx.createGain()
        gainNode.gain.value = volumes[sound.id] // Set initial volume
        
        // Connect: Source -> Gain -> Speakers
        source.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        // Start playing instantly
        source.start(0)
        
        // Store refs to control later
        sourcesRef.current[sound.id] = source
        gainsRef.current[sound.id] = gainNode
      }
    })
    
    setStarted(true)
  }

  // --- 3. VOLUME CONTROL ---
  const updateVolume = (id, val) => {
    const newVol = parseFloat(val)
    setVolumes(prev => ({ ...prev, [id]: newVol }))
    
    // Update Web Audio Gain Node instantly
    if (gainsRef.current[id]) {
      // Smooth transition to prevent clicking sounds
      gainsRef.current[id].gain.setTargetAtTime(newVol, audioCtxRef.current.currentTime, 0.1)
    }
  }

  // --- 4. CANVAS VISUAL ENGINE ---
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let lightningTimer = 0
    
    // Particle Arrays
    let rainDrops = []
    let stars = []
    
    // Resize Handler
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      // Re-init stars on resize
      stars = []
      for(let i=0; i<150; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2,
          blinkSpeed: Math.random() * 0.05
        })
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()

    // RENDER LOOP
    const render = () => {
      // A. BACKGROUND (Day/Night cycle could go here, for now using Dark Void)
      // Clear with slight opacity for trails? No, let's keep it crisp.
      ctx.fillStyle = '#050508' 
      ctx.fillRect(0,0, canvas.width, canvas.height)

      // B. THUNDER FLASH
      // If thunder volume is high, occasionally flash the screen
      if (volumes.thunder > 0.3) {
        if (Math.random() < 0.005 * volumes.thunder) { // Random chance
          lightningTimer = 10 // Frames to stay white
        }
      }
      
      if (lightningTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningTimer * 0.05})`
        ctx.fillRect(0,0, canvas.width, canvas.height)
        lightningTimer--
      }

      // C. STARS (Background Layer)
      ctx.fillStyle = 'white'
      stars.forEach(star => {
        // Twinkle math
        const opacity = 0.5 + Math.sin(Date.now() * 0.001 + star.x) * 0.5
        ctx.globalAlpha = opacity
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI*2)
        ctx.fill()
      })
      ctx.globalAlpha = 1.0

      // D. RAIN (Foreground Layer)
      // Only spawn rain if volume > 0
      if (volumes.rain > 0) {
        const rainCount = Math.floor(volumes.rain * 15) // Intensity
        for(let i=0; i<rainCount; i++) {
          rainDrops.push({
            x: Math.random() * canvas.width,
            y: -20,
            speed: 15 + Math.random() * 10,
            len: 10 + Math.random() * 20
          })
        }
      }

      ctx.strokeStyle = '#88ccff' // Bright Cyan Rain
      ctx.lineWidth = 1.5
      ctx.beginPath()
      
      for(let i=0; i<rainDrops.length; i++) {
        let p = rainDrops[i]
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x, p.y + p.len)
        p.y += p.speed
      }
      ctx.stroke()

      // Cleanup off-screen rain
      rainDrops = rainDrops.filter(p => p.y < canvas.height)

      animationId = requestAnimationFrame(render)
    }

    render()
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [volumes.rain, volumes.thunder]) // Re-bind if volumes change drastically

  // Initialize Audio on Mount
  useEffect(() => {
    initAudio()
  }, [])

  return (
    <>
      <canvas ref={canvasRef} />

      {/* OVERLAY: Shows until user clicks Start */}
      {!started && (
        <div className="overlay">
          <h1>Sonic Sanctuary</h1>
          <p style={{color: '#888', marginBottom: '30px'}}>Procedural Web Audio Engine</p>
          
          {loading ? (
            <div style={{width: '200px'}}>
              <div style={{color: '#00f0ff', marginBottom: '10px'}}>LOADING ASSETS... {Math.round(loadProgress)}%</div>
              <div className="loader"><div className="loader-bar" style={{width: `${loadProgress}%`}}></div></div>
            </div>
          ) : (
            <button className="start-btn" onClick={startExperience}>
              INITIALIZE SYSTEM
            </button>
          )}
        </div>
      )}

      {/* DASHBOARD: Only shows after start */}
      {started && (
        <div className="dashboard-container">
          <div className="dashboard">
            <h1>ATMOSPHERE</h1>
            <div className="subtitle">Audio/Visual Mix</div>
            
            <div className="controls">
              {SOUND_SOURCES.map(s => (
                <div key={s.id} className="control-row">
                  <div className="label">{s.name}</div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={volumes[s.id]}
                    onChange={(e) => updateVolume(s.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
