const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const fs = require('fs');
const port = process.env.PORT || process.env.NODE_PORT || 15119;
const LiveSplitClient = require('livesplit-client');
let livesplitPort = 15721;
let canvasSize = {
  "w": 100,
  "h": 100
};
let canvasPadding = 0;
let defaultRun = "KH3";
let client;
let lsConnected = false;
let splitIndex = -1;
let timerPhase = '';
let delta = '−0.0';
let sobDelta = '−0.0';
let split = {};

let pollingTime = 0.5; // Time in seconds between updates from LiveSplit
let pollingInterval;

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
    if (configJSON.hasOwnProperty('pollingTIme')) {
      pollingTime = configJSON.pollingTime;
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
};

// Function to connect to LiveSplit Server
const lsConnect = async () => {
  if (!lsConnected) {
    try {
      // Initialize client with LiveSplit Server's IP:PORT
      client = new LiveSplitClient(`127.0.0.1:${livesplitPort}`);
    
      // Connected event
      client.on('connected', () => {
          console.log('Connected!');
          lsConnected = true;
          socket.emit('lsConnect', lsConnected);

          // Poll for updates
          pollingInterval = setInterval(lsPoll, pollingTime * 1000);
      });
    
      // Disconnected event
      client.on('disconnected', () => {
          console.log('Disconnected!');
          lsConnected = false;
          socket.emit('lsConnect', lsConnected);

          clearInterval(pollingInterval);
      });
    
      // Connect to the server, Promise will be resolved when the connection will be succesfully established
      await client.connect();
    } catch (err) {
      console.error(err); // Something went wrong
    }
  } else {
    socket.emit('lsConnect', lsConnected);
  }
};

// Function used to parse a delta to an integer
const parseDelta = (d) => {
  // Get and remove the sign at the start of the delta
  let sign = d.slice(0, 1);
  d = d.substring(1);
  //console.dir(sign);
  //console.dir(d);

  let dArr = d.split(':');
  //console.dir(dArr);
  let seconds = 0, modifier = 1;

  while (dArr.length > 0) {
    seconds += modifier * parseFloat(dArr.pop());
    modifier *= 60;
  }

  if (sign === '−') {
    //console.dir('flipping');
    seconds = -seconds;
  }
  return seconds;
};

// Function used for comparing two deltas
const initSplit = (oldDelta, newDelta, oldSOBDelta, newSOBDelta) => {
  // Parse deltas to an int
  let a = parseDelta(oldDelta);
  let b = parseDelta(newDelta);

  let sA = parseDelta(oldSOBDelta);
  let sB = parseDelta(newSOBDelta);

  let timeSave;
  let ahead;
  let gold

  // If the new delta is less than the current one, we saved time
  if (b <= a) {
    timeSave = true;
  } else {
    timeSave = false;
  }

  // If the new delta is negative, we're ahead
  if (b <= 0) {
    ahead = true;
  } else {
    ahead = false;
  }

  // If the new sobDelta is less than the current one, we got a gold split
  if (sB < sA) {
    gold = true;
  } else {
    gold = false;
  }

  // Create a split object that contains the properties we just set
  split = {
    timeSave,
    ahead,
    gold
  };
};

// Function called on reseting a run
const resetRun = () => {
  delta = sobDelta = '−0.0';
  splitIndex = -1;
};

// Function used when polling LiveSplit for updates
const lsPoll = async () => {
  let phase = await client.getCurrentTimerPhase();
  
  if (phase != timerPhase) {
    if (phase === 'NotRunning') {
      if (timerPhase === 'Running') {
        // Reset
        socket.emit('reset');
      }

      resetRun();
    } else if (phase === 'Running' && timerPhase === 'NotRunning') {
      // Start
      socket.emit('start');
    } else if (phase === 'Running' && timerPhase === 'Ended') {
      // Runner finished and then undid the last split
      // We should get rid of the finish animation and handle split

    } else if (phase === 'Ended') {
      // End of run
      socket.emit('end');
    }

    // Update our timerPhase
    timerPhase = phase;
  }

  // Only check for splits if the timer is Running
  if (timerPhase != 'Running') {
    return;
  }

  let index = await client.getSplitIndex();

  // Compare the current and previous splitIndex
  if (index != splitIndex) {
    if (index > splitIndex && index > 0) {
      // A split has occurred since last update
      let d = await client.getDelta();
      let sobD = await client.getDelta('Best Segments');

      // Create an object for the split that occurred
      initSplit(delta, d, sobDelta, sobD);
      split.name = await client.getPreviousSplitname();
      split.index = index;

      // Have the client handle the split
      socket.emit('split', split);

      // Update the deltas
      delta = d;
      sobDelta = sobD;
    };

    // Update the splitIndex
    splitIndex = index; 
  }
};

io.on('connection', (sock) => {
  socket = sock;

  socket.onopen = () => {
    console.dir('socket open');
  }

  socket.on('lsConnect', (data) => {
    lsConnect();
  });
});

app.use(express.static("public"));
app.use(express.static(__dirname + '/node_modules/jquery/dist'));
app.use(express.static(__dirname + '/node_modules/@fortawesome/fontawesome-free'))
app.use(express.static(__dirname + '/node_modules/bootstrap/dist'));
app.use(express.static(__dirname + '/node_modules/socket.io/client-dist'));


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
  loadConfig();
  loadFiles('public/characters/', characters, true);
  loadFiles('public/runs/', runs);
});