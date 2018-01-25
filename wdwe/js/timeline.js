"use strict";

/*
timeline.js
Author: Adam Beagle

DESCRIPTION

Re-creation of the timeline feature from the Walt Disney World Explorer 
2nd Edition PC Game (1998)


USAGE

There are several required controls are regions defined by elements assumed
to be in a container with the class "wdwe-container". These can be seen in
index.html.

This module makes a single object available named wdweTimeline. 
That object exposes the following methods:

  init(canvasId, timeout)
    Initializes the app, starting the asset loading process.
    
    `canvasId` is the id of the canvas element on which the app
    will be drawn. 
    
    `timeout` is the length in milliseconds after 
    which the load process will timeout if it has not yet completed,
    and isTimedOut() willreturn true. Defaults to 10000.
    
  isReady()
    Returns true when asset loading is complete and the app
    is ready to start, false otherwise.
    
  isTimedOut()
    Returns true if the loading process timed out or otherwise
    encountered an irrecoverable error.
  

DEV NOTES

This app is largely driven by custom events 'setyear' and 'slideyear'. 
In addition to the wdweTimeline root, the game elements represented by 
objects under the "Util objects" label also dispatch and respond to 
these events.
*/

var wdweTimeline = function() {
  /* =================== */
  /* DECLARATIONS        */
  /* =================== */
  const CW = 640, // canvas width
        CH = 480, // canvas height
        START_YEAR = 1970,
        END_YEAR = 1998,
        DEFAULT_TIMEOUT = 10000;
  
  var ctx,        // canvas context
      ready,
      images,
      audio,
      timedOut,
      timeout,    // in ms
      canvasOffset,
      currentYear,
      slider,
      startMuted;
      
  /* =================== */
  /* INIT & START        */
  /* =================== */
  
// Initialize game, including all helper objects
  function init() {
    var rect = ctx.canvas.getBoundingClientRect();
    
    ready = false;
    timedOut = false;
    currentYear = START_YEAR;
    canvasOffset = new Position(rect.left, rect.top);
    images = new BackgroundManager();
    audio = new WdweAudioManager();
    slider = new Slider();
    
    // Start asset load
    images.init();
    audio.init();

    window.addEventListener('setyear', setYear, true);
    startWhenReady();
  }
  
  // When asset loading complete, call start()
  // startTime is not required on initial invocation
  function startWhenReady(startTime) {
    var currentTime = new Date().getTime();
    
    if (startTime === undefined) {
      startTime = currentTime;
    }
    // Timeout
    else if (startTime + timeout < currentTime) {
      console.log('Timeout');
      timedOut = true;
      return false;
    }
    
    // Ready
    if (images.isReady() && audio.isReady()) {
      ready = true;
      start();
    }
    // Not ready
    else {
      setTimeout(startWhenReady, 300, startTime);
      return true;
    }
  }
  
  function start() {
    audio.start(startMuted);
    dispatchSetyear(currentYear);
  }
  
  /* =================== */
  /* EVENT               */
  /* =================== */
  
  // Dispatch setyear event for listeners
  // target is optional, and defaults to canvas
  function dispatchSetyear(year, target) {
    var event;
    
    if (!target)
      target = ctx.canvas;
    
    year = normalizeYear(year);
    
    event = new CustomEvent('setyear', {
      detail: year,
      bubbles: true
    });
    target.dispatchEvent(event);
  }
  
  // Dispatch slideyear event for listeners
  // target is optional, and defaults to canvas
  function dispatchSlideyear(year, target) {
    var event;
    
    if (!target)
      target = ctx.canvas;
    
    event = new CustomEvent('slideyear', {
      detail: year,
      bubbles: true
    });
    target.dispatchEvent(event);
  }

  // Bound to setyear event
  function setYear(evt) {
    var year = evt.detail;

    currentYear = year;
  }

  /* =================== */
  /* UTIL FUNCTIONS      */
  /* =================== */
  
  // Normalize year to integer between START_YEAR and END_YEAR
  // Returns START_YEAR for values lower than START_YEAR, and
  // END_YEAR for values greater than END_YEAR
  function normalizeYear(year) {
    year = parseInt(year);
    return Math.max(Math.min(year, END_YEAR), START_YEAR);
  }
  
  /* =================== */
  /* UTIL OBJECTS        */
  /* =================== */
  
  /*
    WdweAudioManager
    Handles all game audio playing, muting, etc.
    
    METHODS
    init()
      Call to initialize asset loading. Audio will not function 
      if this is never called.

    isReady()
      Returns true when asset loading complete and game can begin,
      false otherwise.

    start()
      Call when game ready to start opening audio
  */
  function WdweAudioManager() {
    var audio = new AudioManager();
    
    this.init = function() {
      window.addEventListener('setyear', setYear, true);
      audio.init()
    }
    
    this.isReady = function() {
      return audio.isReady();
    }
    
    this.start = function(muted) {
      var muteEl = document.querySelector('.wdwe-container .mute');
        
      document.querySelector('.repeat-audio').addEventListener(
        'click', repeatAudio, true
      );

      muteEl.addEventListener(
        'click', toggleMute, true
      );

      ctx.canvas.addEventListener('click', function() {
        audio.stop();
      }, true);
      
      if(muted) {
        toggleMute({'target': muteEl});
      }
      else {
        audio.loop('bgmusic');
      }
    }
    
    function setYear(evt) {
      var year = evt.detail;
      
      audio.stop();

      if (year > START_YEAR)
        audio.play('ding');

      audio.play(evt.detail);
    }
    
    function repeatAudio(evt) {
      audio.stop();
      audio.play(currentYear);
    }
    
    function toggleMute(evt) {
      audio.toggleMute();

      if (audio.isMuted())
        evt.target.innerText = "Unmute";
      else {
        evt.target.innerText = "Mute";
        audio.loop('bgmusic');
      }
    }
  } // end WdweAudioManager
  
  /*
    BackgroundManager
    Handles game background loading, updating, and drawing.

    METHODS
    
    init()
      Call to initialize asset loading. Images will not function 
      if this is never called.
    
    isReady()
      Returns true when asset loading complete and game can begin,
      false otherwise.
  */
  function BackgroundManager() {
    const IMAGE_ROOT = 'images/timeline/',
          IMAGE_EXT = '.jpg',
          EXISTING_IMAGES = [
            1970, 1971, 1974, 1975, 1976, 1982, 
            1988, 1989, 1990, 1991, 1992, 1994, 
            1995, 1996, 1997, 1998
          ];
    
    var images = new Map(),
        yearImg;
    
    // ~~~~~~~~~~~~~~~~~~
    // Public
    // ~~~~~~~~~~~~~~~~~~
    this.init = function() {
      var src;
      
      for (let year of EXISTING_IMAGES) {
        src = IMAGE_ROOT + year.toString() + IMAGE_EXT;
        images.set(year, new PreloadImage(src));
      }
      
      window.addEventListener('setyear', setYear, true);
      window.addEventListener('slideyear', setYear, true);
    }
    
    this.isReady = function() {
      for (let img of images.values()) {
        if (!img.isReady()) {
          return false;
        }
      }

      return true;
    }
    
    // ~~~~~~~~~~~~~~~~~~
    // Util
    // ~~~~~~~~~~~~~~~~~~
    function setYear(evt) {
      var year = evt.detail;
      
      yearImg = getImg(year);
      
      while (!yearImg && year >= START_YEAR) {
        yearImg = getImg(year--);
      }
      
      ctx.drawImage(yearImg, 0, 0, CW, CH);
    }
    
    function getImg(key) {
      var img = images.get(key);
      
      if (img)
        return img.img;
      else
        return null;
    }
    
    // Represents single image. isReady() will return
    // true once image is loaded.
    function PreloadImage(src) {
      var ready = false;

      this.img = new Image();
      this.img.src = src;

      this.isReady = function() {
        return ready;
      };

      this.img.onload = function() {
        ready = true;
      };
    };
  }// end ImageManager
  
  /*
    AudioManager
    Reponsible for audio loading and common tasks like playing,
    stopping, muting, etc.

    METHODS

    init()
      Call to begin asset loading. Audio will not function if this 
      is never called.
    isMuted()
    isReady()
       Returns true when asset loading complete.
    play(key)
    loop(key)
    stop([key])
    stopAll()
    stopLoop()
    toggleMute() 
  */
  function AudioManager() {
    const AUDIO_ROOT = 'audio/',
          AUDIO_EXT = '.ogg',
          OTHER_AUDIO = new Map([
            ['bgmusic', 'bgmusic.ogg'],
            ['ding', 'ding.ogg']
          ]);
    
    var audio = new Map(),
        playing = [],
        looping,
        muted = false;
    
    // ~~~~~~~~~~~~~~~~~~
    // Public
    // ~~~~~~~~~~~~~~~~~~
    this.init = function() {
      var src;

      for (let year=START_YEAR; year <= END_YEAR; year++) {
        src = AUDIO_ROOT + year.toString() + AUDIO_EXT;
        audio.set(year, new PreloadAudio(src));
      }
      
      for (let [key, filename] of OTHER_AUDIO) {
        src = AUDIO_ROOT + filename;
        audio.set(key, new PreloadAudio(src));
      }
    }
    
    this.isMuted = function() {
      return muted;
    }
    
    this.isReady = function() {
      return audio.get('bgmusic').isReady() && audio.get(1970).isReady();
    }
    
    this.play = function(key) {
      if (!muted) {
        audio.get(key).audio.play();
        playing.push(key);
      }
    }
    
    // Loop audio.
    // Only one piece of audio can loop at once.
    // If something is already looping and loop() is called,
    // whatever is looping will be stopped.
    this.loop = function(key) {
      var a = audio.get(key).audio
      
      if(muted)
        return;
      
      if (looping) 
        stopLoop();

      a.loop = true;
      a.play();
      looping = key;
    }
    
    // If `key` is given, stop that audio.
    // If not, stop most recently played audio.
    this.stop = function(key) {
      if (key === undefined) {
        key = playing.pop();
        
        // Nothing on stack; return
        if (key === undefined)
          return;
      }
      else {
        let i = playing.indexOf(key);
        
        if (i > -1) {
          playing.splice(i, 1);
        }
      }
      
      stopAudio(audio.get(key).audio);
    }
    
    // Stops all playing audio.
    // Note this does not stop audio started with loop().
    this.stopAll = function() {
      while (playing.length > 0) {
        this.stop();
      }
    }
    
    this.stopLoop = function() {
      if (looping) {
        stopAudio(audio.get(looping).audio);
      }
      
      looping = null;
    }
    
    this.toggleMute = function() {
      muted = !muted;
      
      if (muted) {
        this.stopAll();
        this.stopLoop();
      }
    }
    
    // ~~~~~~~~~~~~~~~~~~
    // Util
    // ~~~~~~~~~~~~~~~~~~
    function stopAudio(a) {
      a.pause();
      a.currentTime = 0.0;
      a.loop = false;
    }
    
    // Represents single audio file/element. 
    // isReady() will return true once audio loaded.
    function PreloadAudio(src) {
      var ready = false;

      this.audio = new Audio(src);
      this.audio.volume = 0.5;

      this.isReady = function() {
        return ready;
      }

      this.audio.addEventListener('canplay', function() {
        ready = true;
      });
    }
  } // end AudioManager
  
  
  /* 
    Slider
    Represents entire year slider, including the monorail train.
    
    Once constructor called, no further action necessary. Updates/draws
    are automatically invoked via setyear and slideyear events.
    
    Note this object will also dispatch setyear and slideyear events.
  */
  function Slider() {
    const EL = document.querySelector('.slider'),
          X = 153,
          W = 458,
          STEP = Math.round(W / (END_YEAR - (START_YEAR + 1)));
    
    var monorail = new Monorail(),
        yearText = new YearText();
    
    window.addEventListener('keydown', handleKeydown, true);
    EL.addEventListener('click', handleClick, true);
    
    function getYearX(year) {
      if (year > START_YEAR) {
        return X + STEP*(year - (START_YEAR + 1));
      }
    }
    
    function handleClick(evt) {
      if (evt.button == 0) {
        var year = yearFromX(evt.clientX - canvasOffset.x);
        dispatchSetyear(year);
        evt.preventDefault();
      }
    }
    
    function handleKeydown(evt) {
      // If keydown is auto-fired on repeat, ignore
      if (evt.repeat) {
        return;
      }

      switch (evt.keyCode) {
        // Left arrow
        case 37:
          if (currentYear > START_YEAR)
            dispatchSetyear(currentYear - 1);
          break;
        // Right arrow
        case 39:
          if (currentYear < END_YEAR)
            dispatchSetyear(currentYear + 1);
          break;
      }
    }
    
    function yearFromX(x) {
      var ratio, yearOffset;
      
      if (x < X) {
        return START_YEAR;
      }
      else if (x > X + W) {
        return END_YEAR;
      }
      else {
        ratio = (x - X) / W;
        yearOffset = Math.round((END_YEAR - (START_YEAR + 1))*ratio);
      
        return Math.min(START_YEAR + 1 + yearOffset, END_YEAR);
      }
    }
    
    // ~~~~~~~~~~~~~~~~~~
    // Util
    // ~~~~~~~~~~~~~~~~~~
    
    /* 
      Monorail
      Manages updates/draws/events for monorail train element,
      which is assumed to have class "monorail".
    */
    function Monorail() {
      const EL = document.querySelector('.monorail'),
            W = EL.clientWidth,
            XMIN = 108,
            XMAX = 592;
      
      EL.onmousedown = handleMousedown;
      setX(XMIN);
      window.addEventListener('setyear', setYear, true);

      // --------
      // Event
      // --------
      function handleMousedown(evt) {
        if (evt.button == 0) {
          document.onmousemove = handleMousemove;
          document.onmouseup = handleMouseup;
          EL.onmouseup = handleMouseup;
          evt.preventDefault(); // Important to prevent dragstart (i.e. no mouseup)
        }
      }
      
      // Note only invoked when already dragging monorail
      function handleMousemove(evt) {
        var cx = evt.clientX - canvasOffset.x,
            year = yearFromX(cx);
        
        dispatchSlideyear(year, EL);
        setX(cx);
      }
      
      function handleMouseup(evt) {
        var cx = evt.clientX - canvasOffset.x,
            year = yearFromX(cx);
        
        dispatchSetyear(year, EL);

        document.onmousemove = null;
        document.onmouseup = null;
        EL.onmouseup = null;
      }
      
      function setYear(evt) {
        var xmid = getYearX(evt.detail);
        
        if (xmid === undefined)
          xmid = XMIN;
        
        setX(xmid);
      }
      
      // --------
      // Util
      // --------
      
      // Return current midpoint of monorail
      function getX() {
        return parseInt(EL.style.left) + (W / 2);
      }
      
      // Set midpoint of monorail
      function setX(x) {
        x -= W / 2;
        x = Math.min(Math.max(x, XMIN), XMAX);
        EL.style.left = x + "px";
      }
    } // end Monorail
    
    /* 
      YearText
      Manages updates/draws/events for year text element,
      which is assumed to have classes "year" and "wdwe-element".
    */
    function YearText() {
      const EL = document.querySelector('.wdwe-element.year'),
            W = EL.clientWidth;
      
      window.addEventListener('setyear', setYear, true);
      window.addEventListener('slideyear', slideYear, true);
      
      function setYear(evt) {
        var year = evt.detail,
            xmid = getYearX(year);
        
        if (year > START_YEAR) {
          EL.innerText = year;
          EL.classList.add("highlight");
          
          EL.style.left = (xmid - (W / 2)) + 'px';
        }
        else {
          EL.innerText = "";
        }
      }
      
      function slideYear(evt) {
        var year = evt.detail;
        
        if (year > START_YEAR + 1 && year < END_YEAR) {
          setYear(evt);
          EL.classList.remove("highlight");
        }
        else {
          EL.innerText = "";
        }
      }
    } // end YearText
  } // end Slider
  
  function Position(x, y) {
    this.x = x;
    this.y = y;
  }
  
  /* =================== */
  /* RETURN
  /* =================== */
  return {
    'init': function(canvasId, _timeout, _startMuted) {
      ctx = document.getElementById(canvasId).getContext('2d');
      ctx.canvas.width = CW;
      ctx.canvas.height = CH;
      timeout = parseInt(_timeout);
      startMuted = _startMuted;
      
      if (isNaN(timeout)) {
        timeout = DEFAULT_TIMEOUT;
      }
      init();
    },
    'isReady': function() {
      return ready;
    },
    'isTimedOut': function() {
      return timedOut;
    }
  };
}();