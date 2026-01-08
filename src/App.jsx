import { useState, useRef, useEffect } from 'react'
import './App.css'

// Using reliable CDN links for demo purposes
const SOUNDS = [
  { id: 'rain', emoji: '🌧️', name: 'Heavy Rain', url: 'https://cdn.pixabay.com/audio/2022/07/04/audio_306283b7e7.mp3' },
  { id: 'fire', emoji: '🔥', name: 'Campfire', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3' },
  { id: 'birds', emoji: '🐦', name: 'Morning Birds', url: 'https://cdn.pixabay.com/audio/2022/02/07/audio_658428461c.mp3' },
  { id: 'ocean', emoji: '🌊', name: 'Ocean Waves', url: 'https://cdn.pixabay.com/audio/2022/03/09/audio_84501f2e6e.mp3' }
]

function App() {
  // We keep track of volume for each sound (0 to 1)
  const [volumes, setVolumes] = useState({ rain: 0, fire: 0, birds: 0, ocean: 0 })
  
  // We use "refs" to hold the actual HTML Audio elements so we can control them without re-rendering everything constantly
  const audioRefs = useRef({})

  // Initialize Audio Objects on first load
  useEffect(() => {
    SOUNDS.forEach(sound => {
      const audio = new Audio(sound.url)
      audio.loop = true // Infinite loop
      audio.volume = 0  // Start silent
      audioRefs.current[sound.id] = audio
    })

    // Cleanup when closing the app
    return () => {
      SOUNDS.forEach(sound => {
        if(audioRefs.current[sound.id]) {
          audioRefs.current[sound.id].pause()
        }
      })
    }
  }, [])

  // Handle Slider Change
  const handleVolumeChange = (id, val) => {
    const newVol = parseFloat(val)
    
    // 1. Update React State (for the slider UI)
    setVolumes(prev => ({ ...prev, [id]: newVol }))
    
    // 2. Update Real Audio Object
    const audio = audioRefs.current[id]
    if (audio) {
      if (newVol > 0 && audio.paused) audio.play() // Auto-start if volume goes up
      if (newVol === 0) audio.pause() // Stop to save CPU if volume is 0
      audio.volume = newVol
    }
  }

  // Toggle Mute (Pause All)
  const muteAll = () => {
    setVolumes({ rain: 0, fire: 0, birds: 0, ocean: 0 })
    SOUNDS.forEach(sound => {
      const audio = audioRefs.current[sound.id]
      if (audio) {
        audio.pause()
        audio.volume = 0
      }
    })
  }

  return (
    <div className="mixer-board">
      <h1>Sonic Sanctuary</h1>
      <p className="subtitle">Design your silence</p>

      <div className="tracks">
        {SOUNDS.map(sound => (
          <div key={sound.id} className="track">
            <div 
              className={`icon ${volumes[sound.id] > 0 ? 'active' : ''}`}
              title={sound.name}
            >
              {sound.emoji}
            </div>
            
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={volumes[sound.id]}
              onChange={(e) => handleVolumeChange(sound.id, e.target.value)} 
            />
          </div>
        ))}
      </div>

      <div className="master-controls">
        <button onClick={muteAll} className="mute-all">
          Silence All
        </button>
      </div>
    </div>
  )
}

export default App

