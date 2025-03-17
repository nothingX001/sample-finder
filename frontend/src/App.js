import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// LiteYouTubeEmbed component with optimized loading
const LiteYouTubeEmbed = ({ videoId, title }) => {
  const [activated, setActivated] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  
  // Generate YouTube thumbnail URL - use webp for faster loading
  const thumbnailUrl = `https://i.ytimg.com/vi_webp/${videoId}/mqdefault.webp`;

  const activatePlayer = () => {
    setActivated(true);
  };

  useEffect(() => {
    // Reset state when videoId changes
    setActivated(false);
    setThumbnailLoaded(false);
    
    // Preload the thumbnail image
    const img = new Image();
    img.src = thumbnailUrl;
    img.onload = () => setThumbnailLoaded(true);
  }, [videoId, thumbnailUrl]);

  return (
    <div 
      className="lite-youtube-embed"
      style={{
        position: 'relative',
        height: '180px',
        width: '100%',
        maxWidth: '600px',
        paddingBottom: '0',
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: '#000',
        margin: '1rem auto'
      }}
      onClick={activatePlayer}
      aria-label={`Play: ${title || 'YouTube Video'}`}
    >
      {!activated ? (
        <>
          <div 
            className="lite-youtube-thumbnail"
            style={{ 
              backgroundImage: thumbnailLoaded ? `url(${thumbnailUrl})` : 'none',
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
          >
            {!thumbnailLoaded && (
              <div className="loading-spinner" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}></div>
            )}
            <div className="lite-youtube-play-button">
              <svg height="100%" version="1.1" viewBox="0 0 68 48" width="100%">
                <path className="play-button-bg" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"></path>
                <path className="play-button-arrow" d="M 45,24 27,14 27,34"></path>
              </svg>
            </div>
          </div>
          <div className="lite-youtube-title">
            {title || ''}
          </div>
        </>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
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
  const [preloadedSongs, setPreloadedSongs] = useState([]);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
  const abortControllerRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);

  // Preload songs without displaying them
  const preloadSongs = useCallback(async (count = 3) => {
    try {
      const songs = [];
      for (let i = 0; i < count; i++) {
        const response = await fetch(`${backendUrl}/random-song`);
        if (response.ok) {
          const data = await response.json();
          if (data) songs.push(data);
        }
      }
      return songs;
    } catch (error) {
      console.error('Error preloading songs:', error);
      return [];
    }
  }, [backendUrl]);

  // Fetch a random song when the user clicks the button
  const fetchRandomSong = useCallback(async () => {
    if (isFetching) return; // Prevent multiple simultaneous requests
    
    try {
      // Cancel any ongoing fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setIsFetching(true);
      setIsLoading(true);
      
      // Use a preloaded song if available
      if (preloadedSongs.length > 0) {
        const nextSong = preloadedSongs[0];
        const remainingSongs = preloadedSongs.slice(1);
        setSong(nextSong);
        setPreloadedSongs(remainingSongs);
        setError(null);
        
        // If we're running low on preloaded songs, fetch more in the background
        if (remainingSongs.length < 2) {
          // Use a separate async operation to avoid affecting the current flow
          setTimeout(async () => {
            const newSongs = await preloadSongs(3 - remainingSongs.length);
            setPreloadedSongs(prev => [...prev, ...newSongs]);
          }, 100);
        }
      } else {
        // Create a new AbortController for this fetch
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;
        
        // Fetch a new song directly
        const response = await fetch(`${backendUrl}/random-song`, { signal });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data) {
          setError('No songs available. Please try again later.');
        } else {
          setSong(data);
          setError(null);
          
          // Preload more songs for future use without affecting the current view
          setTimeout(async () => {
            const newSongs = await preloadSongs(2);
            setPreloadedSongs(prev => [...prev, ...newSongs]);
          }, 100);
        }
      }
    } catch (error) {
      // Ignore AbortError as it's intentional
      if (error.name !== 'AbortError') {
        console.error('Error fetching random song:', error);
        setError('Failed to load song. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [isFetching, preloadedSongs, backendUrl, preloadSongs]);

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

  // Initial load - fetch one song only and preload others without displaying them
  useEffect(() => {
    if (initialLoadCompleteRef.current) return;
    
    async function initialLoad() {
      try {
        setIsFetching(true);
        setIsLoading(true);
        
        // First fetch one song
        const response = await fetch(`${backendUrl}/random-song`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data) {
          setError('No songs available. Please try again later.');
        } else {
          setSong(data);
          setError(null);
          
          // Then preload more songs in the background AFTER displaying the first one
          setTimeout(async () => {
            const preloadedSongs = await preloadSongs(3);
            setPreloadedSongs(preloadedSongs);
          }, 1000);
        }
      } catch (error) {
        console.error('Error during initial load:', error);
        setError('Failed to load initial song. Please try again.');
      } finally {
        setIsLoading(false);
        setIsFetching(false);
        initialLoadCompleteRef.current = true;
      }
    }
    
    initialLoad();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [backendUrl, preloadSongs]);

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
                className="primary-button"
              >
                {isFetching ? 'Loading...' : 'Find New Sample'}
              </button>
              <button onClick={copyLinkToClipboard} className="secondary-button">
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