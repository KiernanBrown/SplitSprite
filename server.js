const express = require("express");
const app = express();
const server = require('http').createServer(app);
const fs = require('fs');
const port = process.env.PORT || process.env.NODE_PORT || 15119;
let livesplitPort = 15721;
let canvasSize = {
  "w": 100,
  "h": 100
};
let canvasPadding = 0;
let defaultRun = "KH3";

let characters = [];
let runs = [];

const loadConfig = () => {
  fs.readFile('./config.json', (err, content) => {
    if (err) {
      console.dir(err);
      return;
    }
    
    // Get the properties from the config file
    let configJSON = JSON.parse(content);
    if (configJSON.hasOwnProperty('livesplitPort')) {
      livesplitPort = configJSON.livesplitPort;
    }
    if (configJSON.hasOwnProperty('canvasSize')) {
      canvasSize = configJSON.canvasSize;
    }
    if (configJSON.hasOwnProperty('canvasPadding')) {
      canvasPadding = configJSON.canvasPadding;
    }
    if (configJSON.hasOwnProperty('defaultRun')) {
      defaultRun = configJSON.defaultRun;
    }
  })
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

app.listen(port, () => {
  console.log(`Listening on ${port}`);
  loadConfig();
  loadFiles('public/characters/', characters, true);
  loadFiles('public/runs/', runs);
});