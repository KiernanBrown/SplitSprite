let splitsSocket;
let timerState;
let prevTimerState;
let runReset = false;
let comparison;
let timingMethod;
let livesplitPort;

let characters;
let activeCharacter;
let previousCharacter;
let runs;
let activeRun;
let currentSwitch;

let dt = 0;
let lastUpdate;
let animQueue = [];
let anim = { "interruptable": true, "completed": true };
let canvas;
let ctx;

let canvasPadding = 0;

let characterImages = [];

// Open a WebSocket that works with LiveSplit
const startSplitsSocket = () => {
  splitsSocket = new WebSocket(`ws://localhost:${livesplitPort}`);
  splitsSocket.onopen = (event) => {
    console.dir('Connected to LiveSplit');
    console.dir(event);

    // Update page
    updateLivesplitButton(true);
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
        let charSwitches = filterSwitches({
          action: 'reset'
        });
        currentSwitch = charSwitches.length > 0 ? charSwitches[0] : undefined;
  
        // Override the default animations if needed
        if(!currentSwitch|| !currentSwitch.override) {
          addAnimations(activeCharacter.actions.reset, 'reset');
        }

        if (currentSwitch) {
          switchCharacter(currentSwitch);
        }

        runReset = true;
      }

      // Run was finished
      if (prevTimerState === 'Ended') {
        addAnimations(activeCharacter.actions.default, 'default');
        runReset = false;
      }
    }
    else if (action === 'start') {
      // A run has started
      // Get any character switches for starting the run
      let charSwitches = filterSwitches({
        action: 'start'
      });
      currentSwitch = charSwitches.length > 0 ? charSwitches[0] : undefined;

      // Override the default animations if needed
      if(!currentSwitch|| !currentSwitch.override) {
        // Give extra animations if this is a run after a failed run
        if (runReset) {
          addAnimations(activeCharacter.actions.retry, 'retry');
        }
        addAnimations(activeCharacter.actions.ahead, 'ahead');
      }

      // Switch characters if needed
      if (currentSwitch) {
        switchCharacter(currentSwitch);
      }

      // Set comparison and timingMethod
      console.dir(data);
      comparison = data.state.currentComparison;
      timingMethod = data.state.currentTimingMethod === 'RealTime' ? 'realTime' : 'gameTime';
    } else if (action === 'split') {
      // A split has occurred
      // Get information on the split
      const split = data.state.run.segments[data.state.currentSplitIndex - 1];
      const prevSplit = data.state.currentSplitIndex > 1 ? data.state.run.segments[data.state.currentSplitIndex - 2] : undefined;

      // Get any character switches for this split
      let charSwitches = filterSwitches({
        action: 'split',
        splitName: split.name,
        splitIndex: data.state.currentSplitIndex - 1
      });
      currentSwitch = charSwitches.length > 0 ? charSwitches[0] : undefined;

      // Override the default animations if needed
      if(!currentSwitch|| !currentSwitch.override) {
        // If timerState === 'Ended', run was finished
        if (timerState === 'Ended') {
          addAnimations(activeCharacter.actions.finish, 'finish');
        } else {
          handleSplit(split, prevSplit, true);
        }
      }

      // Switch characters if needed
      if (currentSwitch) {
        switchCharacter(currentSwitch);
        handleSplit(split, prevSplit, true, true);
      }
    } else if (action === 'switch-comparison') {
      // Update the current comparison
      comparison = data.state.currentComparison;

      // Get information about the current split with the new comparison
      // This information only exists if the runner has split this run
      // EX: Comparison changed from PB where the runner was behind to average where the runner is now ahead. Animations should change accordingly.
      console.dir(data);
      const split = data.state.run.segments[data.state.currentSplitIndex - 1];
      const prevSplit = data.state.currentSplitIndex > 1 ? data.state.run.segments[data.state.currentSplitIndex - 2] : undefined;

      // Handle splits if the split exists
      if (split) {
        // Remove animations for ahead or behind
        removeAnimations('ahead');
        removeAnimations('behind');
        handleSplit(split, prevSplit);
      }
    } 

    // Attempt to reconnect if the socket is closed
    splitsSocket.onclose = (e) => {
      console.dir('Socket closed');
      updateLivesplitButton(false);
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

// Handles animations given the current and previous split
const handleSplit = (split, prevSplit, splitting, overriding) => {
  const splitTime = split.splitTime[timingMethod];
  const comparisonTime = split.comparisons[comparison][timingMethod];

  // First check split duration to see if time was saved or lost
  // This only happens if the runner just split (not on comparison switch)
  if (splitting) {
    // Get the splitTime of the previous split (if it exists)
    let prevSplitTime = 0;
    let prevComparisonTime = 0;
    if (prevSplit) {
      prevSplitTime = prevSplit.splitTime[timingMethod];
      prevComparisonTime = prevSplit.comparisons[comparison][timingMethod];
    }

    // Get the duration of the current split and comparison
    let splitDuration = splitTime - prevSplitTime;
    let comparisonDuration = comparisonTime - prevComparisonTime;

    // Check if we saved or lost time
    if (!overriding) {
      if (!split.bestSegment[timingMethod] || splitDuration <= split.bestSegment[timingMethod]) {
        // Gold Split
        addAnimations(activeCharacter.actions.split_gold, 'split_gold');
      } else if (splitDuration <= comparisonDuration || comparisonDuration <= 0) {
        // Split that saved time
        addAnimations(activeCharacter.actions.split_timesave, 'split_timesave');
      } else {
        // Split that lost time
        addAnimations(activeCharacter.actions.split_timeloss, 'split_timeloss');
      }
    }
  }

  // Then check if we're ahead or behind
  if (splitTime <= comparisonTime || comparisonTime <= 0) {
    addAnimations(activeCharacter.actions.ahead, 'ahead');
  } else {
    addAnimations(activeCharacter.actions.behind, 'behind');
  }
};

// Initializes the characters array with characters from the server
const initCharacters = () => {
  console.dir("Fetching chars");
  fetch('/characters')
  .then(res => res.json())
  .then(charactersJSON => {
    characters = charactersJSON;
    console.dir(characters);
    console.dir(charactersJSON);

    let loadPromises = []; // Array of promises used for loading images

    // Load the images for each spritesheet
    characters.forEach(char => {
      char.images = [];
      for (const a in char.animations) {
        // Create a promise for loading the image and add it to the array
        let loadPromise = loadImage(`characters/${char.name.toLowerCase()}/${a}.png`, a);
        loadPromises.push(loadPromise);

        // Once the promise resolves, add the image to the character's images
        loadPromise.then((data) => {
          char.images.push({
            "name": data.name,
            "img": data.img
          });
        });
      };
    });

    // Once all images have loaded, add the default animation for the active character
    Promise.all(loadPromises).then(() => {
      initRuns();
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
    return c.name.toLowerCase() === name.toLowerCase()
  });

  if (filteredCharacters.length > 0) {
    previousCharacter = activeCharacter;
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

  if (anim.completed && animQueue.length > 0 && anim.interruptable) {
    console.dir('first change anim');
    changeAnimation();
  }

  let prevFrame = anim.currentFrame || -1;
  anim.frameTime += dt;
  while (anim.frameTime >= anim.fpsTime) {
    anim.frameTime -= anim.fpsTime;
    if (anim.reverse) {
      anim.currentFrame--;
    } else {
      anim.currentFrame++;
    }

    // Complete the animation if this was the last frame
    if (anim.currentFrame >= anim.frames && !anim.reverse) {
      completeAnimation(anim);
    }

    if (anim.currentFrame < 0 && anim.reverse) {
      completeAnimation(anim);
    }
  }

  // Draw the new frame if this is a different frame
  if (anim.currentFrame != prevFrame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (anim.hasOwnProperty('source')) {
      ctx.drawImage(anim.source.img, anim.currentFrame * anim.frameSize.w + anim.padding * anim.currentFrame, 0, anim.frameSize.w, anim.frameSize.h, anim.x, anim.y, anim.frameSize.w, anim.frameSize.h);
    }
  }

  requestAnimationFrame(updateSprites);
};

// Completes the specified animation (and loops it if needed)
const completeAnimation = (anim) => {
  anim.completed = true;
  if (!anim.loop) {
    if (animQueue.length > 0) {
      changeAnimation();
    }
    requestAnimationFrame(updateSprites);
    return;
  } 
  anim.currentFrame = anim.reverse ? anim.frames - 1 : 0;

  if (animQueue.length > 0) {
    changeAnimation();
  }
};

// Adds animations from an action to the animation queue
const addAnimations = (anims, action) => {
  console.dir(anims);
  console.dir(action);
  anims.forEach(a => {
    let addAnim = activeCharacter.animations[a.animation];
    console.dir(`characters/${activeCharacter.name.toLowerCase()}/${a.animation}.png`);
    console.dir(addAnim.frameSize);
    console.dir(addAnim);
    console.dir(a);
    animQueue.push({
      "source": getImage(a.animation),
      "frameSize": addAnim.frameSize,
      "frames": addAnim.frames,
      "fps": addAnim.fps,
      "fpsTime": 1000 / addAnim.fps,
      "padding": addAnim.padding || 0,
      "frameTime": 0,
      "currentFrame": 0,
      "action": action,
      "x": addAnim.offset ? (canvas.width / 2) - Math.floor(addAnim.frameSize.w / 2) + addAnim.offset.x : (canvas.width / 2) - Math.floor(addAnim.frameSize.w / 2),
      "y": addAnim.offset ? canvas.height - canvasPadding - addAnim.frameSize.h + addAnim.offset.y : canvas.height - canvasPadding - addAnim.frameSize.h,
      "interruptable": addAnim.interruptable,
      "loop": a.loop,
      "reverse": a.reverse
    });
  });
};

// Remove animations from the animation queue that have the matching action
// This does not affect the current animation, only queued animations
const removeAnimations = (action) => {
 animQueue = animQueue.filter(anim => {
  return anim.action != action;
 });
};

const changeAnimation = () => {
  // Get our new animation
  console.dir('changing animation');
  anim = animQueue.shift();

  // Set the currentFrame to be the starting frame
  // 0 if playing normally, last frame if playing in reverse
  anim.currentFrame = anim.reverse ? anim.frames - 1 : 0;
  console.dir(anim);
};

// Switches the active character
const switchCharacter = (charSwitch) => {
  if (!charSwitch.hasOwnProperty('conditionalCharacters') || charSwitch.conditionalCharacters.includes(activeCharacter.name)) {
    if (charSwitch.switchOut) {
      addAnimations(activeCharacter.actions[charSwitch.switchOut], "switch");
    }
    switch (charSwitch.switchCharacter.toLowerCase()) {
      case "$defaultcharacter" : 
        setCharacter(activeRun.defaultCharacter);
        break;
      case "$previouscharacter":
        if (previousCharacter) {
          setCharacter(previousCharacter);
        }
        break;
      default:
        setCharacter(charSwitch.switchCharacter);
    }

    if (charSwitch.switchIn) {
      addAnimations(activeCharacter.actions[charSwitch.switchIn], "switch");
    }
  }
};

// Initializes the canvas
const initCanvas = () => {
  canvas = document.getElementById('spriteCanvas');
  ctx = canvas.getContext('2d');

  fetch('/canvas')
  .then(res => res.json())
  .then(canvasJSON => {
    canvasPadding = canvasJSON.canvasPadding;
    canvas.width = canvasJSON.canvasSize.w;
    canvas.height = canvasJSON.canvasSize.h + canvasPadding * 2;
  });
};

//Initializes the runs array with runs from the server
const initRuns = () => {
  fetch('/runs')
  .then(res => res.json())
  .then(runsJSON => { 
    runs = runsJSON.runs;
    console.dir(runsJSON);
    console.dir(runs);
    setRun(runsJSON.defaultRun);
    addAnimations(activeCharacter.actions.default, 'default');
  });
};

// Sets the activeRun to the run specified
const setRun = (name) => {
  let filteredRuns = runs.filter(r => {
    return r.name.toLowerCase() === name.toLowerCase();
  });

  if (filteredRuns.length > 0) {
    activeRun = filteredRuns[0];
    setCharacter(activeRun.defaultCharacter);
  }
};

// Filters characterSwitches based on the criteria passed in
// Returns an array of characterSwitches that match the criteria
const filterSwitches = (criteria) => {
  let validSwitches = activeRun.characterSwitches;

  if (criteria.action) {
    validSwitches = validSwitches.filter(charSwitch => {
      return charSwitch.action === criteria.action;
    });
  }

  if (criteria.hasOwnProperty('splitName') && criteria.hasOwnProperty('splitIndex')) {
    validSwitches = validSwitches.filter(charSwitch => {
      return charSwitch.splitName.toLowerCase() === criteria.splitName.toLowerCase() || charSwitch.splitIndex === criteria.splitIndex;
    });
  }

  validSwitches = validSwitches.filter(charSwitch => {
    if (charSwitch.hasOwnProperty('conditionalCharacters')) {
      return charSwitch.conditionalCharacters.includes(activeCharacter.name);
    } else {
      return true;
    }
  });
  
  return validSwitches;
};

// Function to update livesplitButton when we connect/disconnect with LiveSplit
const updateLivesplitButton = (connected) => {
  if (connected) {
    // Disabled green button showing connected status
    let lsButton = document.getElementById('livesplitButton');
    lsButton.classList.remove('btn-danger');
    lsButton.classList.add('btn-success');
    lsButton.setAttribute('disabled', true);

    let lsButtonContent = document.getElementById('livesplitButtonContent');
    lsButtonContent.innerHTML = '<span id="livesplitButtonContent" class="icon"><i class="fas fa-check-circle"></i> LiveSplit - Connected</span>';
  } else {
    // Red button showing disconnected status
    let lsButton = document.getElementById('livesplitButton');
    lsButton.classList.remove('btn-success');
    lsButton.classList.add('btn-danger');
    lsButton.removeAttribute('disabled');

    let lsButtonContent = document.getElementById('livesplitButtonContent');
    lsButtonContent.innerHTML = '<span id="livesplitButtonContent" class="icon"><i class="fas fa-exclamation-circle"></i> LiveSplit - Not Connected</span>';
  }
};

window.onload = () => {
  // Click listener for livesplitButton
  // Attempts to reconnect if not connected to LiveSplit when clicked
  let lsButton = document.getElementById('livesplitButton').addEventListener('click', () => {
    if (splitsSocket.readyState === WebSocket.CLOSED) {
      console.dir('Attempting reconnect');
      startSplitsSocket();
    } 
  });

  // Initialize tooltips
  $(document).ready(function(){
    $('[data-toggle="tooltip"]').tooltip();
  });

  // Initialize Canvas and Characters
  initCanvas();
  initCharacters();

  // Attempt to connect to LiveSplit
  fetch('/livesplitPort')
  .then(res => res.json())
  .then(lsPort => { 
    livesplitPort = lsPort;
    startSplitsSocket();
  });

  // Start updating sprites
  lastUpdate = Date.now();
  requestAnimationFrame(updateSprites);
};
