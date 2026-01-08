import { useState, useRef, useEffect } from 'react'
import './App.css'

// EXPANDED SOUND LIBRARY (Music + Ambience)
const SOUNDS = [
  // NATURE
  { id: 'rain', emoji: '🌧️', name: 'Rain', url: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg' },
  { id: 'thunder', emoji: '⛈️', name: 'Thunder', url: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg' },
  { id: 'ocean', emoji: '🌊', name: 'Waves', url: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'birds', emoji: '🐦', name: 'Birds', url: 'https://actions.google.com/sounds/v1/animals/birds_forest_morning.ogg' },
  { id: 'night', emoji: '🦗', name: 'Crickets', url: 'https://actions.google.com/sounds/v1/animals/crickets.ogg' },
  
  // MUSICAL TEXTURES (Using reliable looping samples)
  { id: 'wind', emoji: '🍃', name: 'Wind', url: 'https://actions.google.com/sounds/v1/weather/wind_blowing.ogg' },
]

function App() {
  const [volumes, setVolumes] = useState({})
  const [timeOfDay, setTimeOfDay] = useState('day') // morning, day, evening, night
  const [clock, setClock] = useState('')
  const audioRefs = useRef({})

  // 1. TIME ENGINE: Check real clock every minute
  useEffect(() => {
    const checkTime = () => {
      const now = new Date()
      const hour = now.getHours()
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setClock(timeString)

      // Determine "Vibe" based on hour
      let vibe = 'day'
      if (hour >= 5 && hour < 11) vibe = 'morning'
      else if (hour >= 11 && hour < 17) vibe = 'day'
      else if (hour >= 17 && hour < 21) vibe = 'evening'
      else vibe = 'night'

      setTimeOfDay(vibe)
      
      // Inject the class into the <body> tag for global CSS changes
      document.body.className = vibe
    }

    checkTime() // Run immediately
    const interval = setInterval(checkTime, 60000) // Run every minute
    return () => clearInterval(interval)
  }, [])

  // 2. AUDIO ENGINE
  useEffect(() => {
    // Initialize volumes state
    const volState = {}
    SOUNDS.forEach(s => volState[s.id] = 0)
    setVolumes(volState)

    // Create Audio Objects
    SOUNDS.forEach(sound => {
      const audio = new Audio(sound.url)
      audio.loop = true
      audio.volume = 0
      audioRefs.current[sound.id] = audio
    })

    return () => {
      SOUNDS.forEach(s => audioRefs.current[s.id]?.pause())
    }
  }, [])

  const handleVolumeChange = (id, val) => {
    const newVol = parseFloat(val)
    setVolumes(prev => ({ ...prev, [id]: newVol }))
    
    const audio = audioRefs.current[id]
    if (audio) {
      if (newVol > 0 && audio.paused) audio.play()
      if (newVol === 0) audio.pause()
      audio.volume = newVol
    }
  }

  const muteAll = () => {
    const reset = {}
    SOUNDS.forEach(s => {
      reset[s.id] = 0
      if (audioRefs.current[s.id]) {
        audioRefs.current[s.id].pause()
        audioRefs.current[s.id].volume = 0
      }
    })
    setVolumes(reset)
  }

  // Preset: "Auto-Tune" based on time
  const autoVibe = () => {
    muteAll()
    // Small delay to let mute finish
    setTimeout(() => {
      if (timeOfDay === 'night') {
        handleVolumeChange('night', 0.6) // Crickets
        handleVolumeChange('wind', 0.3) // Wind
      } else if (timeOfDay === 'morning') {
        handleVolumeChange('birds', 0.5)
        handleVolumeChange('rain', 0.2)
      } else {
        handleVolumeChange('ocean', 0.5)
        handleVolumeChange('wind', 0.2)
      }
    }, 100)
  }

  return (
    <div className="mixer-board">
      <div className="header">
        <h1>Lofi Sync</h1>
        <div className="time-badge">{timeOfDay} • {clock}</div>
      </div>

      <div className="tracks">
        {SOUNDS.map(sound => (
          <div key={sound.id} className="track">
            <div className={`icon ${volumes[sound.id] > 0 ? 'active' : ''}`}>
              {sound.emoji}
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={volumes[sound.id] || 0}
              onChange={(e) => handleVolumeChange(sound.id, e.target.value)} 
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button className="mute-all" onClick={muteAll}>Silence</button>
        <button className="mute-all" onClick={autoVibe} style={{background: 'white', color: 'black'}}>
          ✨ Auto-Mix
        </button>
      </div>
    </div>
  )
}

export default App
