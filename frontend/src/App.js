import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [song, setSong] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyMessage, setCopyMessage] = useState('');

  // Fetch a random song from the backend
  const fetchRandomSong = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/random-song`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSong(data);
    } catch (error) {
      console.error('Error fetching random song:', error);
    } finally {
      setIsLoading(false);
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
  }, []);

  return (
    <div style={{ textAlign: 'center', margin: '50px' }}>
      <h1>SAMPLE FINDER</h1>
      <p>Find random samples from curated channels.</p>

      {isLoading ? (
        <p>Loading...</p>
      ) : song ? (
        <div>
          <iframe
            width="560"
            height="315"
            src={`https://www.youtube.com/embed/${song.videoId}`}
            title={song.title}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          ></iframe>
          <h2>{song.title}</h2>
          <p>Channel: {song.channel}</p>

          <div style={{ marginTop: '20px' }}>
            <button onClick={fetchRandomSong} style={{ marginRight: '10px' }}>
              Find New Sample
            </button>
            <button onClick={copyLinkToClipboard}>Copy Link</button>
          </div>

          <div>Tip: Screen record or convert video to audio for use.</div>

          {copyMessage && <p style={{ marginTop: '10px', color: 'green' }}>{copyMessage}</p>}
        </div>
      ) : (
        <p>No song found. Try again later!</p>
      )}
    </div>
  );
}

export default App;
