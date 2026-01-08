import { useState, useEffect, useRef } from 'react'
import './App.css'

// RELIABLE MP3 LINKS
const SOUNDS = [
  { id: 'rain', label: 'RAIN', url: 'https://cdn.pixabay.com/audio/2022/07/04/audio_306283b7e7.mp3' }, // Pixabay Rain
  { id: 'thunder', label: 'STORM', url: 'https://cdn.pixabay.com/audio/2021/08/09/audio_03d6f35b26.mp3' }, // Pixabay Thunder
  { id: 'piano', label: 'PIANO', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3' }, // Sad Piano Loop
  { id: 'fire', label: 'FIRE', url: 'https://cdn.pixabay.com/audio/2021/09/06/audio_472f9156a5.mp3' }  // Crackling Fire
]

function App() {
  const [volumes, setVolumes] = useState({ rain: 0, thunder: 0, piano: 0, fire: 0 })
  const [isNight, setIsNight] = useState(false)
  const audioRefs = useRef({})
  const canvasRef = useRef(null)

  // --- AUDIO ENGINE ---
  useEffect(() => {
    // 1. Initialize Audio
    SOUNDS.forEach(s => {
      const audio = new Audio(s.url)
      audio.loop = true
      audio.volume = 0
      audioRefs.current[s.id] = audio
    })

    // 2. Check Time for Day/Night mode
    const h = new Date().getHours()
    setIsNight(h >= 19 || h < 6) // Night is 7PM to 6AM

    return () => {
      // Cleanup
      Object.values(audioRefs.current).forEach(a => a.pause())
    }
  }, [])

  const handleVolume = (id, val) => {
    const v = parseFloat(val)
    setVolumes(prev => ({ ...prev, [id]: v }))
    
    const audio = audioRefs.current[id]
    if (audio) {
      if (v > 0 && audio.paused) audio.play().catch(e => console.log("Audio play failed:", e))
      if (v === 0) audio.pause()
      audio.volume = v
    }
  }

  // --- CANVAS PHYSICS ENGINE (The Visuals) ---
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationFrameId
    
    // Set Canvas Size
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', resize)
    resize()

    // Particle Systems
    const raindrops = []
    const stars = []

    // Initialize Stars (Static)
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        opacity: Math.random()
      })
    }

    const render = () => {
      // 1. Clear Screen (with trail effect for motion blur)
      ctx.fillStyle = isNight ? '#050510' : '#4a6fa5' // Deep Night vs Blue Day
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 2. Draw Stars (If Night)
      if (isNight) {
        ctx.fillStyle = 'white'
        stars.forEach(star => {
          ctx.globalAlpha = star.opacity
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      // 3. Draw Rain (Only if volume > 0)
      if (volumes.rain > 0) {
        // Add new drops based on volume intensity
        const intensity = volumes.rain * 5 // More volume = more drops
        for (let i = 0; i < intensity; i++) {
          raindrops.push({
            x: Math.random() * canvas.width,
            y: -20, // Start above screen
            speed: Math.random() * 10 + 10 + (volumes.rain * 10), // Faster if louder
            length: Math.random() * 20 + 10
          })
        }

        ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        
        // Loop backwards to remove old drops easily
        for (let i = raindrops.length - 1; i >= 0; i--) {
          const drop = raindrops[i]
          
          // Draw Line
          ctx.moveTo(drop.x, drop.y)
          ctx.lineTo(drop.x, drop.y + drop.length)
          
          // Move Drop
          drop.y += drop.speed

          // Remove if off screen
          if (drop.y > canvas.height) {
            raindrops.splice(i, 1)
          }
        }
        ctx.stroke()
      }

      animationFrameId = window.requestAnimationFrame(render)
    }

    render()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
    }
  }, [volumes.rain, isNight]) // Re-run logic if rain volume changes

  return (
    <>
      <canvas id="bg-canvas" ref={canvasRef}></canvas>
      
      <div className="interface">
        <h1>THE VOID</h1>
        <div className="status">
          {isNight ? "NIGHT MODE ACTIVE" : "DAY MODE ACTIVE"} • {Math.floor(volumes.rain * 100)}% PRECIPITATION
        </div>

        {SOUNDS.map(s => (
          <div key={s.id} className="track-row">
            <div className="label">{s.label}</div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={volumes[s.id]}
              onChange={(e) => handleVolume(s.id, e.target.value)}
            />
          </div>
        ))}

        <button 
          className="mute-btn" 
          onClick={() => {
            setVolumes({ rain: 0, thunder: 0, piano: 0, fire: 0 })
            Object.values(audioRefs.current).forEach(a => a.pause())
          }}
        >
          SILENCE ALL
        </button>
      </div>
    </>
  )
}

export default App
