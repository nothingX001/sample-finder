const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const fetch = require('node-fetch');
const xml2js = require('xml2js');
const cron = require('node-cron');
const NodeCache = require('node-cache'); // You'll need to install this: npm install node-cache

// Models
const Channel = require('./models/Channel');
const Song = require('./models/Song');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

// Initialize cache with 30 minute TTL
const songCache = new NodeCache({ stdTTL: 1800, checkperiod: 600 });
const CACHE_KEY_SONG_IDS = 'all_song_ids';
const CACHE_KEY_RANDOM_SONGS = 'random_songs';
const CACHE_SIZE = 50; // Number of random songs to keep cached

app.use(cors());
app.use(express.json());

// Add request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(10000, () => {
    res.status(408).send('Request Timeout');
  });
  next();
});

// MongoDB connection with optimized settings
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000, // Reduced from 30s to 15s
    socketTimeoutMS: 30000,          // Reduced from 45s to 30s
    poolSize: 10,                   // Maintain up to 10 socket connections
    heartbeatFrequencyMS: 30000,    // Check server status every 30 seconds
  })
  .then(() => {
    console.log('Connected to MongoDB');
    // Populate cache after connection
    populateSongCache();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Default YouTube Channels - unchanged from your original code
const DEFAULT_CHANNELS = [
  { channelId: 'UCXxNR5OIs52ZQUDc9RlAing', name: 'Channel 1' },
  { channelId: 'UCY8_y20lxQhhBe8GZl5A9rw', name: 'Channel 2' },
  { channelId: 'UCKydEBEvAU5zkN8o1snt62A', name: 'Channel 3' },
  { channelId: 'UC2CMBX0xUGWdK9SmewrU8B', name: 'Channel 4' },
  { channelId: 'UCg4HwkoSEhqyvk_qwiB5M7g', name: 'Channel 5' },
  { channelId: 'UCbFRFUEgRI64ZogqawRh5Wg', name: 'Channel 6' },
  { channelId: 'UCLcnbgnInVXNeR4mnB6-ScQ', name: 'Channel 7' },
  { channelId: 'UC-RVESJTf_zSaFB8qGoxOnA', name: 'Channel 9' },
  { channelId: 'UCZPDvPgP_E1Z-qyMppvJsRQ', name: 'Channel 10' },
  { channelId: 'UCKgYw7coD5LZXGiS-sXnzJQ', name: 'Channel 11' },
  { channelId: 'UC-T9Vf1N9MwW8HttzC_KIaQ', name: 'Channel 12' },
  { channelId: 'UCVBZ9XZcgv0h3dscFWaHNgA', name: 'Channel 13' },
  { channelId: 'UCD3m_nnW8Tma4FIhg56IuIA', name: 'Channel 14' },
  { channelId: 'UCtrJ2-RStj9rX6SOGzv7ybA', name: 'Channel 15' },
];

// Populate song cache to improve random song performance
async function populateSongCache() {
  try {
    console.log('Populating song cache...');
    
    // Get all song IDs and cache them
    const songIds = await Song.find({}, '_id').lean();
    songCache.set(CACHE_KEY_SONG_IDS, songIds.map(song => song._id.toString()));
    
    // Pre-cache some random songs for immediate access
    await cacheRandomSongs(CACHE_SIZE);
    
    console.log(`Song cache populated with ${songIds.length} songs`);
  } catch (err) {
    console.error('Error populating song cache:', err.message);
  }
}

// Seed Default Channels - unchanged from your original code
async function seedDefaultChannels() {
  try {
    const existingChannels = await Channel.countDocuments();
    if (existingChannels === 0) {
      console.log('Seeding default channels...');
      await Channel.insertMany(DEFAULT_CHANNELS);
      console.log('Default channels seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding channels:', err.message);
  }
}

// Cache a batch of random songs for quick access
async function cacheRandomSongs(count) {
  try {
    const songIds = songCache.get(CACHE_KEY_SONG_IDS);
    if (!songIds || songIds.length === 0) {
      console.log('No song IDs in cache to generate random songs');
      return;
    }
    
    const randomSongs = [];
    const usedIndexes = new Set();
    
    // Get 'count' random songs
    for (let i = 0; i < Math.min(count, songIds.length); i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * songIds.length);
      } while (usedIndexes.has(randomIndex) && usedIndexes.size < songIds.length);
      
      usedIndexes.add(randomIndex);
      const songId = songIds[randomIndex];
      
      if (songId) {
        const song = await Song.findById(songId).lean();
        if (song) {
          randomSongs.push(song);
        }
      }
    }
    
    songCache.set(CACHE_KEY_RANDOM_SONGS, randomSongs);
    console.log(`Cached ${randomSongs.length} random songs`);
  } catch (err) {
    console.error('Error caching random songs:', err.message);
  }
}

// Fetch Videos from YouTube RSS Feeds - optimized with Promise.allSettled
async function fetchVideosFromRSS() {
  try {
    const channels = await Channel.find({}).lean();
    const parser = new xml2js.Parser();
    const results = [];

    console.log(`Starting to fetch videos from ${channels.length} channels...`);

    // Use Promise.allSettled to prevent a single failure from stopping all fetches
    const fetchPromises = channels.map(async (channel) => {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
      console.log(`Fetching RSS feed for channel: ${channel.name}`);

      try {
        // Set timeout for fetch to avoid hanging
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(rssUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Sample Finder App/1.0' }
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
          console.error(`Failed to fetch RSS for ${channel.name}: ${response.status}`);
          return [];
        }

        const rssData = await response.text();
        return new Promise((resolve) => {
          parser.parseString(rssData, (err, result) => {
            if (err) {
              console.error(`Error parsing RSS for ${channel.name}: ${err.message}`);
              return resolve([]);
            }
            
            const videos = [];
            if (result.feed && result.feed.entry) {
              result.feed.entry.forEach((video) => {
                videos.push({
                  videoId: video['yt:videoId'][0],
                  title: video.title[0],
                  channel: video.author[0].name[0],
                });
              });
            }
            resolve(videos);
          });
        });
      } catch (error) {
        console.error(`Error processing channel ${channel.name}: ${error.message}`);
        return [];
      }
    });

    const settledPromises = await Promise.allSettled(fetchPromises);
    settledPromises.forEach(promise => {
      if (promise.status === 'fulfilled') {
        results.push(...promise.value);
      }
    });

    // Use bulk operations for better performance
    if (results.length > 0) {
      const operations = results.map(song => ({
        updateOne: {
          filter: { videoId: song.videoId },
          update: { $set: song },
          upsert: true
        }
      }));
      
      const bulkResult = await Song.bulkWrite(operations);
      console.log(`${bulkResult.upsertedCount} new songs inserted, ${bulkResult.modifiedCount} songs updated`);
      
      // Update the cache after insertion
      await populateSongCache();
      
      return { 
        success: true, 
        inserted: bulkResult.upsertedCount, 
        updated: bulkResult.modifiedCount 
      };
    }

    return { success: true, processed: 0 };
  } catch (error) {
    console.error('Error in fetchVideosFromRSS:', error.message);
    return { success: false, error: error.message };
  }
}

// Initial setup
async function initialize() {
  await seedDefaultChannels();
  await fetchVideosFromRSS();
}

// Run initialization on startup
initialize()
  .then(() => console.log('Initialization completed'))
  .catch(err => console.error('Initialization failed:', err));

// Schedule cache refresh - every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled cache refresh...');
  await populateSongCache();
});

// Schedule regular updates - fetch videos every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running scheduled video fetch...');
  await fetchVideosFromRSS();
  console.log('Scheduled video fetch completed');
});

// API Endpoints
app.get('/fetch-from-rss', async (req, res) => {
  try {
    const result = await fetchVideosFromRSS();
    res.json(result);
  } catch (error) {
    console.error('Error in fetch-from-rss endpoint:', error.message);
    res.status(500).json({ error: 'Failed to fetch videos from RSS feeds.' });
  }
});

// Get a Random Song - with caching
app.get('/random-song', async (req, res) => {
  try {
    // Try to get a pre-cached random song
    const cachedRandomSongs = songCache.get(CACHE_KEY_RANDOM_SONGS);
    
    if (cachedRandomSongs && cachedRandomSongs.length > 0) {
      // Get and remove one song from the cache
      const randomSong = cachedRandomSongs.shift();
      songCache.set(CACHE_KEY_RANDOM_SONGS, cachedRandomSongs);
      
      // If cache is running low, refresh it asynchronously
      if (cachedRandomSongs.length < 10) {
        cacheRandomSongs(CACHE_SIZE - cachedRandomSongs.length).catch(console.error);
      }
      
      return res.json(randomSong);
    } 
    
    // Fallback to database query if cache is empty
    const count = await Song.countDocuments();
    if (count === 0) {
      console.log('No songs found in database');
      return res.json(null);
    }

    const randomIndex = Math.floor(Math.random() * count);
    const song = await Song.findOne().skip(randomIndex).lean();
    res.json(song);
    
    // Refill the cache asynchronously
    cacheRandomSongs(CACHE_SIZE).catch(console.error);
  } catch (error) {
    console.error('Error fetching random song:', error.message);
    res.status(500).json({ error: 'Failed to fetch a random song.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    cacheStatus: {
      songIds: songCache.has(CACHE_KEY_SONG_IDS),
      randomSongs: songCache.has(CACHE_KEY_RANDOM_SONGS) ? 
        songCache.get(CACHE_KEY_RANDOM_SONGS).length : 0
    }
  });
});

// Root Route
app.get('/', (req, res) => {
  res.send('Welcome to the Sampler App!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app; // Export for testing purposes