const express = require("express");
const app = express();
const server = require('http').createServer(app);
const port = process.env.PORT || process.env.NODE_PORT || 3000;
const fs = require('fs');

let characters = [];

const loadCharacters = () => {
  const dirName = 'public/characters/';
  fs.readdir(dirName, (err, filenames) => {
    if (err) {
      console.dir(err);
      return;
    }

    filenames.forEach((file) => {
      fs.readFile(dirName + file + `/${file}.json`, (err, content) => {
        if (err) {
          console.dir(err);
          return;
        }
        // Parse the JSON file and add it to the characters array
        characters.push(JSON.parse(content));
      });
    });
  });
};

app.use(express.static("public"));

app.get('/', (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get('/characters', (req, res) => {
  res.json(characters);
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
  loadCharacters();
});