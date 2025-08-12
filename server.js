const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/photos/list', (req, res) => {
  const dir = path.join(__dirname, 'photos');
  fs.readdir(dir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to list photos' });
    }
    const images = files.filter(f => /\.(png|jpe?g|gif)$/i.test(f));
    res.json(images);
  });
});

app.get('/presents/list', (req, res) => {
  const dir = path.join(__dirname, 'presents');
  fs.readdir(dir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to list presents' });
    }
    const images = files.filter(f => /\.(png|jpe?g|gif)$/i.test(f));
    res.json(images);
  });
});

app.get('/songs/list', (req, res) => {
  const dir = path.join(__dirname, 'songs');
  fs.readdir(dir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to list songs' });
    }
    const songs = files.filter(f => /\.(mp3|m4a|wav|ogg)$/i.test(f));
    res.json(songs);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
