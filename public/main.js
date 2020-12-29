let splitsSocket;
let timerState;
let prevTimerState;
let runReset = false;

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
      // A run has been reset
      console.dir(prevTimerState);     
      // Run was reset before finishing
      if(prevTimerState === 'Running') {
        addAnimations(activeCharacter.actions.reset);
        runReset = true;
      }

      // Run was finished
      if (prevTimerState === 'Ended') {
        addAnimations(activeCharacter.actions.default);
        runReset = false;
      }
    }
    if (action === 'start') {
      // A run has started
      // Give extra animations if this is a run after a failed run
      if (runReset) {
        addAnimations(activeCharacter.actions.retry);
      }
      addAnimations(activeCharacter.actions.ahead);
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
      
      // If timerState === 'Ended', run was finished
      if (timerState === 'Ended') {
        addAnimations(activeCharacter.actions.finish);
      }
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
    console.dir(characters);
    console.dir(charactersJSON);

    let loadPromises = []; // Array of promises used for loading images

    // Load the images for each spritesheet
    characters.forEach(char => {
      char.images = [];
      for (const a in char.animations) {
        // Create a promise for loading the image and add it to the array
        let loadPromise = loadImage(`characters/${activeCharacter.name.toLowerCase()}/${a}.png`, a);
        loadPromises.push(loadPromise);

        // Once the promise resolves, add the image to the character's images
        loadPromise.then((data) => {
          char.images.push({
            "name": data.name,
            "img": data.img
          });
        });
      };

      // Update page
      let charText = document.createElement('h2');
      charText.textContent = `Character: ${activeCharacter.name}`;
      document.getElementById('content').appendChild(charText);

      // Once all images have loaded, add the default animation for the active character
      Promise.all(loadPromises).then(() => {
        addAnimations(activeCharacter.actions.default);
      });
    });
  });
};

// Loads an image given a source and name
const loadImage = (source, name) => {
  return new Promise(resolve => {
    // Create a new image
    const img = new Image();
    img.src = source;

    // Resolve the promise once the image has loaded
    img.addEventListener('load', () => {
      resolve({name, img});
    });
  });
};

// Sets the activeCharacter to the character specified
const setCharacter = (name) => {
  let filteredCharacters = characters.filter(c => {
    return c.name === name;
  });

  if (filteredCharacters.length > 0) {
    activeCharacter = filteredCharacters[0];
  }
};

// Get a spritesheet based on the given name
const getImage = (name) => {
  console.dir(activeCharacter.images);
  console.dir('Getting Image: ' + name);
  let filteredImages = activeCharacter.images.filter(img => {
    return img.name === name;
  });
  console.dir(filteredImages);
  return filteredImages[0];
};

const updateSprites = () => {
  // Delta time
  dt = Date.now() - lastUpdate; 
  lastUpdate = Date.now();

  if (anim.completed && animQueue.length > 0) {
    // Get our new animation
    console.dir('changing animation');
    anim = animQueue.shift();
    anim.currentFrame = 0;
    console.dir(anim);
  }

  let prevFrame = anim.currentFrame || -1;
  anim.frameTime += dt;
  while (anim.frameTime >= anim.fpsTime) {
    anim.frameTime -= anim.fpsTime;
    anim.currentFrame++;

    // Complete the animation if this was the last frame
    if (anim.currentFrame >= anim.frames) {
      anim.completed = true;
      if (!anim.loop) {
        requestAnimationFrame(updateSprites);
        return;
      } 
      anim.currentFrame = 0;
    }
  }

  // Draw the new frame if this is a different frame
  if (anim.currentFrame != prevFrame) {
    ctx.clearRect(0, 0, 100, 100);

    if (anim.hasOwnProperty('source')) {
      ctx.drawImage(anim.source.img, anim.currentFrame * anim.frameSize.w, 0, anim.frameSize.w, anim.frameSize.h, anim.x, anim.y, anim.frameSize.w, anim.frameSize.h);
    }
  }

  requestAnimationFrame(updateSprites);
};

// Adds animations from an action to the animation queue
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
