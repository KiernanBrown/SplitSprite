let splitsSocket;
let timerState;
let prevTimerState;

let characters;
let activeCharacter;

let dt = 0;
let lastUpdate;
const animQueue = [];
let anim = { "completed": true };
let canvas;
let ctx;

let characterImages = [];

// Open a WebSocket that works with LiveSplit
const startSplitsSocket = () => {
  splitsSocket = new WebSocket('ws://localhost:15721');
  splitsSocket.onopen = (event) => {
    console.dir('Connected to LiveSplit');
    console.dir(event);

    // Update page
    let connectText = document.createElement('h2');
    connectText.textContent = `Connected to LiveSplit!`;
    document.getElementById('content').appendChild(connectText);

    initCharacters();
  };

  splitsSocket.onmessage = (event) => {
    console.dir('Message Received');
    let data = JSON.parse(event.data);
    let action;
    if (data.action) {
      action = data.action.action;
    }
    console.dir(action);

    // Update the timerState
    prevTimerState = timerState;
    timerState = data.state.timerState;

    if (action === 'reset') {
      // A run has reset
    }
    if (action === 'start') {
      // A run has started
    } else if (action === 'split') {
      // A split has occurred
      // Get information on the split
      console.dir(data);
      split = data.state.run.segments[data.state.currentSplitIndex - 1];
      console.dir(split);

      // Information on if we are ahead or behind can be gotten as follows:
      // Get the current comparison from split.comparisons
      // Compare the current timing method (realTime or gameTime) to the split.splitTime 
      // If splitTime is < the comparison, we are ahead. Otherwise, we're behind
      // splitTime is the time on the timer when splitting, not split duration
      // Split duration can be found by taking the splitTime of the current split and subtracting the previous split's splitTime from it (if that split exists)
    } else if (action === 'switch-comparison') {
      // Update the current comparison
      // EX: Comparison changed from PB where the runner was behind to average where the runner is now ahead. Animations should change accordingly.
    }

    // Attempt to reconnect if the socket is closed
    splitsSocket.onclose = (e) => {
      console.dir('Socket closed');
      setTimeout(() => {
        console.dir('Reconnecting');
        startSplitsSocket();
      }, 1000);
    };

    splitsSocket.onerror = (error) => {
      console.dir(error);
    };

  };
};

// Initializes the characters array with characters from the server
const initCharacters = () => {
  console.dir("Fetching chars");
  fetch('/characters')
  .then(res => res.json())
  .then(charactersJSON => {
    characters = charactersJSON;
    setCharacter('Sora');

    // Update page
    let charText = document.createElement('h2');
    charText.textContent = `Character: ${activeCharacter.name}`;
    document.getElementById('content').appendChild(charText);

    // The current issue is we cannot draw using an image until that image has loaded
    // Before adding an action, we should do a check here to make sure each spritesheet has loaded in (or just the necessary spritesheets?)
    // For now, we can get around this by just using a timeout

    // Use the default action
    setTimeout(() => {
      addAnimations(activeCharacter.actions.default);
    }, 6000);
    
  });
};

// Sets the activeCharacter to the character specified
const setCharacter = (name) => {
  let filteredCharacters = characters.filter(c => {
    return c.name === name;
  });

  if (filteredCharacters.length > 0) {
    activeCharacter = filteredCharacters[0];

    // Set images
    characterImages = [];
    console.dir(activeCharacter.animations);
    for (const a in activeCharacter.animations) {
      console.dir(a);
      console.dir(`characters/${activeCharacter.name.toLowerCase()}/${a}.png`);
      let img = new Image();
      img.src = `characters/${activeCharacter.name.toLowerCase()}/${a}.png`;
      img.onload = () => {
        console.dir(img);
        characterImages.push({
          "name": a,
          "img": img
        });
      }

    }
  }
};

const getImage = (name) => {
  console.dir(characterImages);
  console.dir('Getting Image: ' + name);
  let filteredImages = characterImages.filter(img => {
    return img.name === name;
  });
  console.dir(filteredImages);
  return filteredImages[0];
};

const updateSprites = () => {
  console.dir('updating');
  // Delta time
  dt = Date.now() - lastUpdate; 
  lastUpdate = Date.now();

  if (anim.completed && animQueue.length > 0) {
    // Get our new animation
    console.dir('changing animation');
    anim = animQueue.shift();
  }

  let prevFrame = anim.currentFrame || -1;
  anim.frameTime += dt;
  while (anim.frameTime >= anim.fpsTime) {
    anim.frameTime -= anim.fpsTime;
    anim.currentFrame++;

    // Complete the animation if this was the last frame
    if (anim.currentFrame >= anim.frames) {
      anim.completed = true;
      anim.currentFrame = 0;
      if (!anim.loop) return;
    }
  }

  if (anim.currentFrame != prevFrame) {
    ctx.clearRect(0, 0, 100, 100);

    if (anim.hasOwnProperty('source')) {
      ctx.drawImage(anim.source.img, anim.currentFrame * anim.frameSize.w, 0, anim.frameSize.w, anim.frameSize.h, anim.x, anim.y, anim.frameSize.w, anim.frameSize.h);
    }
  }

  requestAnimationFrame(updateSprites);
};

const addAnimations = (anims) => {
  anims.forEach(a => {
    let addAnim = activeCharacter.animations[a.animation];
    console.dir(`characters/${activeCharacter.name.toLowerCase()}/${a.animation}.png`);
    console.dir(addAnim.frameSize);
    animQueue.push({
      "source": getImage(a.animation),
      "frameSize": addAnim.frameSize,
      "frames": addAnim.frames,
      "fps": addAnim.fps,
      "fpsTime": 1000 / addAnim.fps,
      "frameTime": 0,
      "currentFrame": 0,
      "x": (canvas.width / 2) - Math.floor(addAnim.frameSize.w / 2),
      "y": canvas.height - addAnim.frameSize.h,
      "loop": a.loop
    });
  });
};

// Connect to LiveSplit when the window loads
window.onload = () => {
  canvas = document.getElementById('spriteCanvas');
  ctx = canvas.getContext('2d');

  startSplitsSocket();
  lastUpdate = Date.now();

  requestAnimationFrame(updateSprites);
};
