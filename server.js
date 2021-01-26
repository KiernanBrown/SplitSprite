const express = require("express");
const app = express();
const server = require('http').createServer(app);
const port = require('./config.json').port || process.env.PORT || process.env.NODE_PORT || 3000;
const livesplitPort = require('./config.json').livesplitPort || 15721;
const fs = require('fs');

const {
  canvasSize,
  canvasPadding,
  defaultRun
} = require('./config.json');

let characters = [];
let runs = [];

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

const loadFiles = (dirName, fileArr, subFolder) => {
  fs.readdir(dirName, (err, filenames) => {
    if (err) {
      console.dir(err);
      return;
    }

    filenames.forEach((file) => {
      let fileStr = subFolder ? dirName + file + `/${file}.json` : dirName + file;
      fs.readFile(fileStr, (err, content) => {
        if (err) {
          console.dir(err);
          return;
        }
        // Parse the JSON file and add it to the characters array
        fileArr.push(JSON.parse(content));
      });
    });
  });
}

app.use(express.static("public"));
app.use(express.static(__dirname + '/node_modules/jquery/dist'));
app.use(express.static(__dirname + '/node_modules/@fortawesome/fontawesome-free'))
app.use(express.static(__dirname + '/node_modules/bootstrap/dist'));


app.get('/', (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get('/characters', (req, res) => {
  res.json(characters);
});

app.get('/runs', (req, res) => {
  res.json({
    runs,
    defaultRun
  });
});

app.get('/canvas', (req, res) => {
  res.json({
    canvasSize,
    canvasPadding
  });
});

app.get('/livesplitPort', (req, res) => {
  res.json(livesplitPort);
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
  loadFiles('public/characters/', characters, true);
  loadFiles('public/runs/', runs);
});