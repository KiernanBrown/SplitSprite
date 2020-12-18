let splitsSocket;
let timerState;
let prevTimerState;

// Open a WebSocket that works with LiveSplit
function startSplitsSocket() {
  splitsSocket = new WebSocket('ws://localhost:15721');
  splitsSocket.onopen = (event) => {
    console.dir('Connected to LiveSplit');
    console.dir(event);
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

window.onload = () => {
  startSplitsSocket();
};
