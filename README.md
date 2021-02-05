# SpriteSplit
SpriteSplit is a NodeJS project designed for video game speedrunners. SpriteSplit works with LiveSplit, the most popular timer for speedrunning, to allow for sprite animation based on a runner's current run. These animations are done using a canvas on an HTML page and the locally hosted project can be used as a browser source in OBS to have these animations show on livestreams or recordings.

This project supports using JSON files for Runs and Characters, and allows for users to create their own files that fit the needs of the game that they are running. Included with this project are fiels for two characters (Sora and Final World Sora) and a file for a run (KH3) that I personally use for my Kingdom Hearts III Beginner Any% speedruns. If you are looking to use this project for a run of your own, feel free to use the files that I have provided here, or if you have basic knowledge of JSON then you can make your own! More information on how these files work and should be setup can be found in the wiki for this project here: [SpriteSplit Wiki](https://github.com/KiernanBrown/SpriteSplit/wiki)

## Table of Contents
* [Features](#features)
* [Required Programs](#programs)

## Features <a name="features"></a>
* Sprite animations for common actions in a run (splitting, being ahead/behind, golding a split, etc.)
* Automatically adjusts to comparison changes
* Supports switching characters mid run

## Required Programs <a name="programs"></a>
As mentioned above, SpriteSplit works with the timer software LiveSplit. The newest version of LiveSplit can be downloaded here: [LiveSplit Downloads Page](https://livesplit.org/downloads/)
This project also requires the LiveSplit Websocket Server component in order to read information from LiveSplit using a Websocket connection. The download and setup information for this component can be found here: [https://github.com/MeGotsThis/LiveSplit.WebSocketServer](https://github.com/MeGotsThis/LiveSplit.WebSocketServer)