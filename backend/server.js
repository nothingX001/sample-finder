const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

// Models
const Channel = require('./models/Channel');
const Song = require('./models/Song');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Wait up to 30 seconds
    socketTimeoutMS: 45000,         // Keep socket open for 45 seconds
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Default YouTube Channels
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

// Seed Default Channels
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
seedDefaultChannels();

// Fetch Videos from YouTube RSS Feeds
app.get('/fetch-from-rss', async (req, res) => {
    try {
      const channels = await Channel.find({});
      const parser = new xml2js.Parser();
      const results = [];

      await Promise.all(
        channels.map(async (channel) => {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
          console.log(`Fetching RSS feed for channel: ${channel.name}`);

          const response = await fetch(rssUrl);
          if (!response.ok) {
            console.error(`Failed to fetch RSS for ${channel.name}`);
            return;
          }

          const rssData = await response.text();
          await new Promise((resolve, reject) => {
            parser.parseString(rssData, (err, result) => {
              if (err) {
                return reject(err);
              }
              if (result.feed && result.feed.entry) {
                result.feed.entry.forEach((video) => {
                  results.push({
                    videoId: video['yt:videoId'][0],
                    title: video.title[0],
                    channel: video.author[0].name[0],
                  });
                });
              }
              resolve();
            });
          });
        })
      );

      // Insert new songs while ignoring duplicates
      let insertedCount = 0;
      for (const song of results) {
        try {
          await Song.updateOne(
            { videoId: song.videoId }, // Check if the videoId already exists
            { $set: song },            // Update if exists, insert if not
            { upsert: true }           // Insert only if it doesn't exist
          );
          insertedCount++;
        } catch (err) {
          console.error(`Failed to insert/update song: ${song.title}`, err.message);
        }
      }

      console.log(`${insertedCount} new songs inserted/updated.`);
      res.json({ success: true, added: insertedCount });
    } catch (error) {
      console.error('Error fetching RSS feeds:', error.message);
      res.status(500).json({ error: 'Failed to fetch videos from RSS feeds.' });
    }
  });

// Get a Random Song
app.get('/random-song', async (req, res) => {
  try {
    const count = await Song.countDocuments();
    if (count === 0) return res.json(null);

    const randomIndex = Math.floor(Math.random() * count);
    const song = await Song.findOne().skip(randomIndex);
    res.json(song);
  } catch (error) {
    console.error('Error fetching random song:', error.message);
    res.status(500).json({ error: 'Failed to fetch a random song.' });
  }
});

// Root Route
app.get('/', (req, res) => {
  res.send('Welcome to the Sampler App!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
