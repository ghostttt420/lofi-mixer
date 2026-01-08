import { useState, useEffect, useRef } from 'react'
import './App.css'

// ASSETS
const SOUND_SOURCES = [
  { id: 'rain', name: 'RAIN', url: 'https://cdn.pixabay.com/audio/2022/07/04/audio_306283b7e7.mp3' }, 
  { id: 'thunder', name: 'STORM', url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_03d6f35b26.mp3' },
  { id: 'city', name: 'CITY', url: 'https://cdn.pixabay.com/audio/2021/09/06/audio_0c946f0470.mp3' }, 
  { id: 'music', name: 'SYNTH', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3' } 
]

function App() {
  const [started, setStarted] = useState(false)
  const [statusText, setStatusText] = useState("INITIALIZE SYSTEM")
  const [volumes, setVolumes] = useState({ rain: 0.5, thunder: 0, city: 0, music: 0 }) 
  
  const audioCtxRef = useRef(null)
  const sourcesRef = useRef({})
  const gainsRef = useRef({})
  const buffersRef = useRef({})
  const canvasRef = useRef(null)

  // 1. CLICK TO START (Required by Browsers)
  const initAudioSystem = async () => {
    setStatusText("LOADING AUDIO...")
    
    // Create Context
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioCtxRef.current = new Ctx()
    const ctx = audioCtxRef.current

    // Load Sounds
    for (let sound of SOUND_SOURCES) {
      try {
        const response = await fetch(sound.url)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        buffersRef.current[sound.id] = audioBuffer
      } catch (err) {
        console.error("Audio Load Error", err)
      }
    }

    // Play Sounds
    SOUND_SOURCES.forEach(sound => {
      const buffer = buffersRef.current[sound.id]
      if (buffer) {
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        
        const gainNode = ctx.createGain()
        gainNode.gain.value = volumes[sound.id]
        
        source.connect(gainNode)
        gainNode.connect(ctx.destination)
        source.start(0)
        
        sourcesRef.current[sound.id] = source
        gainsRef.current[sound.id] = gainNode
      }
    })

    setStarted(true)
  }

  // 2. VOLUME HANDLE
  const updateVolume = (id, val) => {
    const newVol = parseFloat(val)
    setVolumes(prev => ({ ...prev, [id]: newVol }))
    if (gainsRef.current[id]) {
      gainsRef.current[id].gain.setTargetAtTime(newVol, audioCtxRef.current.currentTime, 0.1)
    }
  }

  // 3. CANVAS ENGINE (Rain & Stars)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let lightningTimer = 0
    let stars = []
    let rainDrops = []

    // Setup Canvas
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      stars = []
      for(let i=0; i<100; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2,
          opacity: Math.random()
        })
      }
    }
    window.addEventListener('resize', resize)
    resize()

    const render = () => {
      // Clear
      ctx.fillStyle = '#050510'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Lightning Logic
      if (volumes.thunder > 0.3 && Math.random() < 0.005 * volumes.thunder) lightningTimer = 10
      if (lightningTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningTimer * 0.05})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        lightningTimer--
      }

      // Draw Stars
      ctx.fillStyle = 'white'
      stars.forEach(s => {
        ctx.globalAlpha = 0.3 + Math.random() * 0.5
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI*2)
        ctx.fill()
      })
      ctx.globalAlpha = 1.0

      // Draw Rain
      if (volumes.rain > 0) {
        // Spawn Drops
        const count = Math.floor(volumes.rain * 10)
        for(let i=0; i<count; i++) {
          rainDrops.push({
            x: Math.random() * canvas.width,
            y: -20,
            speed: 15 + Math.random() * 10,
            len: 10 + Math.random() * 20
          })
        }
        
        ctx.strokeStyle = '#00f0ff' // Neon Blue Rain
        ctx.lineWidth = 2
        ctx.beginPath()
        for(let i=rainDrops.length-1; i>=0; i--) {
          let p = rainDrops[i]
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x, p.y + p.len)
          p.y += p.speed
          if (p.y > canvas.height) rainDrops.splice(i, 1)
        }
        ctx.stroke()
      }

      animationId = requestAnimationFrame(render)
    }
    render()
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [volumes])

  return (
    <>
      <canvas ref={canvasRef} />

      {/* OVERLAY - Shows until started */}
      {!started && (
        <div className="overlay">
          <h1 style={{marginBottom: '40px'}}>SONIC SANCTUARY</h1>
          <button className="start-btn" onClick={initAudioSystem}>
            {statusText}
          </button>
        </div>
      )}

      {/* DASHBOARD - Shows after started */}
      {started && (
        <div className="dashboard-container">
          <div className="dashboard">
            <h1>ATMOSPHERE</h1>
            <div className="subtitle">System Active</div>
            
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
