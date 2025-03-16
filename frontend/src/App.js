import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// LiteYouTubeEmbed component with fixed dimensions
const LiteYouTubeEmbed = ({ videoId, title }) => {
  const [activated, setActivated] = useState(false);
  const containerRef = useRef(null);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

  // Generate YouTube thumbnail URL
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const activatePlayer = () => {
    setActivated(true);
  };

  useEffect(() => {
    // Reset state when videoId changes
    setActivated(false);
    setThumbnailLoaded(false);
  }, [videoId]);

  return (
    <div 
      ref={containerRef} 
      className="lite-youtube-embed"
      style={{
        width: '100%',         // Full width of parent container
        height: '315px',       // Fixed height - standard 16:9 YouTube height
        position: 'relative',  // For proper positioning of elements
        overflow: 'hidden',    // Hide overflow
        cursor: 'pointer',
        backgroundColor: '#000'
      }}
      onClick={activatePlayer}
    >
      {!activated ? (
        <>
          <div 
            className="lite-youtube-thumbnail"
            style={{ 
              backgroundImage: thumbnailLoaded ? `url(${thumbnailUrl})` : 'none',
              backgroundColor: '#000',
              position: 'absolute',
              top: '0',
              left: '0',
              bottom: '0',
              right: '0',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <img 
              src={thumbnailUrl} 
              alt={title || 'YouTube Video'} 
              style={{ display: 'none' }}
              onLoad={() => setThumbnailLoaded(true)}
            />
            <div className="lite-youtube-play-button"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '68px',
                height: '48px'
              }}
            >
              <svg height="100%" version="1.1" viewBox="0 0 68 48" width="100%">
                <path className="play-button-bg" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"></path>
                <path className="play-button-arrow" d="M 45,24 27,14 27,34"></path>
              </svg>
            </div>
          </div>
          <div 
            className="lite-youtube-title"
            style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              padding: '10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title || ''}
          </div>
        </>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title || 'YouTube Video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        ></iframe>
      )}
    </div>
  );
};

function App() {
  const [song, setSong] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState('');
  const [preloadedSong, setPreloadedSong] = useState(null);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch a random song from the backend
  const fetchRandomSong = async () => {
    if (isFetching) return; // Prevent multiple simultaneous requests
    
    try {
      setIsFetching(true);
      setIsLoading(true);
      
      // Use the preloaded song if available
      if (preloadedSong) {
        setSong(preloadedSong);
        setPreloadedSong(null);
        setError(null);
        
        // Immediately start preloading the next song
        fetchNextSong();
      } else {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/random-song`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data) {
          setError('No songs available. Please try again later.');
        } else {
          setSong(data);
          setError(null);
          
          // Preload next song after current one is loaded
          fetchNextSong();
        }
      }
    } catch (error) {
      console.error('Error fetching random song:', error);
      setError('Failed to load song. Please try again.');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  // Preload the next song
  const fetchNextSong = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/random-song`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data) {
        setPreloadedSong(data);
      }
    } catch (error) {
      console.error('Error preloading next song:', error);
    }
  };

  // Copy the YouTube link to clipboard
  const copyLinkToClipboard = async () => {
    if (!song || !song.videoId) return;
    const youtubeUrl = `https://www.youtube.com/watch?v=${song.videoId}`;

    try {
      await navigator.clipboard.writeText(youtubeUrl);
      setCopyMessage('Link copied!');
      setTimeout(() => setCopyMessage(''), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setCopyMessage('Failed to copy link.');
      setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  useEffect(() => {
    fetchRandomSong();
    
    // Cleanup function
    return () => {
      // Cancel any pending state updates
    };
  }, []);

  return (
    <div className="App">
      <div className="App-header">
        <h1>SAMPLE FINDER</h1>
        <p>Random samples from curated channels.</p>
      </div>

      <main>
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>{error}</p>
            <button 
              onClick={fetchRandomSong} 
              disabled={isFetching}
            >
              Try Again
            </button>
          </div>
        ) : song ? (
          <div className="song-container">
            <LiteYouTubeEmbed
              videoId={song.videoId}
              title={song.title}
            />
            <h2>{song.title}</h2>
            <p className="channel-name">Channel: {song.channel}</p>

            <div className="button-group">
              <button 
                onClick={fetchRandomSong} 
                disabled={isFetching}
              >
                {isFetching ? 'Loading...' : 'Find New Sample'}
              </button>
              <button onClick={copyLinkToClipboard}>
                Copy Link
              </button>
            </div>

            <div className="tip-container">
              <p>Tip: Screen record or convert video to audio for use.</p>
            </div>

            {copyMessage && <p className="copyMessage">{copyMessage}</p>}
          </div>
        ) : (
          <div className="no-song-container">
            <p>No song found. Try again later!</p>
            <button 
              onClick={fetchRandomSong}
              disabled={isFetching}
            >
              Retry
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;