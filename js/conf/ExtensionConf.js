if(Debug.debug)
  console.log("Loading: ExtensionConf.js");

var ExtensionConf = {
  basicExtensionMode: "blacklist",
  extensionMode: "whitelist", // how should this extension work? 
                              //       'blacklist' - work everywhere except blacklist
                              //       'whitelist' - only work on whitelisted sites
                              //       'disabled'  - work nowhere
  arDetect: {
    mode: "blacklist",        // how should autodetection work?
                              //       'blacklist' - work by default, problem sites need to be blocked
                              //       'whitelist' - only work if site has been specifically approved
                              //       'disabled'  - don't work at all 
    disabledReason: "",       // if automatic aspect ratio has been disabled, show reason
    allowedMisaligned: 0.05,  // top and bottom letterbox thickness can differ by this much. 
                              // Any more and we don't adjust ar.
    allowedArVariance: 0.075, // amount by which old ar can differ from the new (1 = 100%)
    timer_playing: 666,       // we trigger ar this often (in ms) under this conditions
    timer_paused: 3000,
    timer_error: 3000,
    timer_minimumTimeout: 5,  // but regardless of above, we wait this many msec before retriggering
    autoDisable: {            // settings for automatically disabling the extension
      maxExecutionTime: 6000, // if execution time of main autodetect loop exceeds this many milliseconds,
                              // we disable it.
      consecutiveTimeoutCount: 5,  // we only do it if it happens this many consecutive times

      // FOR FUTURE USE
      consecutiveArResets: 5       // if aspect ratio reverts immediately after AR change is applied, we disable everything
    },
    hSamples: 640,
    vSamples: 360,
    // samplingInterval: 10,     // we sample at columns at (width/this) * [ 1 .. this - 1] 
    blackLevel_default: 10,   // everything darker than 10/255 across all RGB components is considered black by
                              // default. blackLevel can decrease if we detect darker black.
    blackbarTreshold: 16,     // if pixel is darker than blackLevel + blackbarTreshold, we count it as black
                              // on 0-255. Needs to be fairly high (8 might not cut it) due to compression
                              // artifacts in the video itself
    variableBlackbarTresholdOptions: {    // In case of poor bitrate videos, jpeg artifacts may cause us issues
      // FOR FUTURE USE
      enabled: true,                      // allow increasing blackbar threshold
      disableArDetectOnMax: true,         // disable autodetection when treshold goes over max blackbar treshold
      maxBlackbarTreshold: 48,            // max threshold (don't increase past this)
      thresholdStep: 8,                   // when failing to set aspect ratio, increase treshold by this much
      increaseAfterConsecutiveResets: 2   // increase if AR resets this many times in a row
    },
    staticSampleCols: 9,      // we take a column at [0-n]/n-th parts along the width and sample it
    randomSampleCols: 0,      // we add this many randomly selected columns to the static columns
    staticSampleRows: 9,      // forms grid with staticSampleCols. Determined in the same way. For black frame checks
    guardLine: {              // all pixels on the guardline need to be black, or else we trigger AR recalculation 
                              // (if AR fails to be recalculated, we reset AR)
      enabled: true,
      ignoreEdgeMargin: 0.20, // we ignore anything that pokes over the black line this close to the edge
                              // (relative to width of the sample)
      imageTestTreshold: 0.1, // when testing for image, this much pixels must be over blackbarTreshold
      edgeTolerancePx: 2,         // black edge violation is performed this far from reported 'last black pixel'
      edgeTolerancePercent: null  // unused. same as above, except use % of canvas height instead of pixels
    },
    fallbackMode: {
      enabled: true,
      safetyBorderPx: 5,        // determines the thickness of safety border in fallback mode
      noTriggerZonePx: 8        // if we detect edge less than this many pixels thick, we don't correct.
    },
    arSwitchLimiter: {          // to be implemented 
      switches: 2,              // we can switch this many times
        period: 2.0             // per this period
    },
    edgeDetection: {
      sampleWidth: 8,        // we take a sample this wide for edge detection
      detectionTreshold: 4,  // sample needs to have this many non-black pixels to be a valid edge
      singleSideConfirmationTreshold: 0.3,   // we need this much edges (out of all samples, not just edges) in order
                                             // to confirm an edge in case there's no edges on top or bottom (other
                                            // than logo, of course)
      logoTreshold: 0.15,     // if edge candidate sits with count greater than this*all_samples, it can't be logo
                              // or watermark.
      edgeTolerancePx: 2,          // we check for black edge violation this far from detection point
      edgeTolerancePercent: null,  // we check for black edge detection this % of height from detection point. unused
      middleIgnoredArea: 0.2,      // we ignore this % of canvas height towards edges while detecting aspect ratios
      minColsForSearch: 0.5,       // if we hit the edge of blackbars for all but this many columns (%-wise), we don't
                                   // continue with search. It's pointless, because black edge is higher/lower than we
                                   // are now. (NOTE: keep this less than 1 in case we implement logo detection)
      edgeTolerancePx: 1,          // tests for edge detection are performed this far away from detected row 
    },
    pillarTest: {
      ignoreThinPillarsPx: 5, // ignore pillars that are less than this many pixels thick. 
      allowMisaligned: 0.05   // left and right edge can vary this much (%)
    },
    textLineTest: {
      nonTextPulse: 0.10,     // if a single continuous pulse has this many non-black pixels, we aren't dealing 
                              // with text. This value is relative to canvas width (%)
      pulsesToConfirm: 10,    // this is a treshold to confirm we're seeing text.
      pulsesToConfirmIfHalfBlack: 5, // this is the treshold to confirm we're seeing text if longest black pulse
                                     // is over 50% of the canvas width
      testRowOffset: 0.02     // we test this % of height from detected edge
    }
  },
  arChange: {
    samenessTreshold: 0.025,  // if aspect ratios are within 2.5% within each other, don't resize
  },
  zoom: {
    minLogZoom: -1,
    maxLogZoom: 3,
    announceDebounce: 200     // we wait this long before announcing new zoom
  },
  miscSettings: {
    videoFloat: "center",
    mousePan: {
      enabled: false
    },
    mousePanReverseMouse: false,
    defaultAr: "original",
  },
  stretch: {
    initialMode: 0,                     // 0 - no stretch, 1 - basic, 2 - hybrid, 3 - conditional
    conditionalDifferencePercent: 0.05  // black bars less than this wide will trigger stretch
                                        // if mode is set to '1'. 1.0=100%
  },
  resizer: {
    setStyleString: {
      maxRetries: 3,
      retryTimeout: 200
    }
  },
  pageInfo: {
    timeouts: {
      urlCheck: 200,
      rescan: 1500
    }
  },
  colors:{
    //     criticalFail: "background: #fa2; color: #000"
  },
  keyboard: {
  },
  // List of all possible actions, for use in settings
  // TODO: move to separate file as this shouldn't be user-settable
  actionsList: [{
    action: 'set-ar',
    args: [{
      name: 'Automatic',
      arg: 'auto',
    },{
      name: 'Fit width',
      arg: 'fitw'
    },{
      name: 'Fit height',
      arg: 'fith',
    },{
      name: 'Reset',
      arg: 'reset',
    },{
      name: 'Ratio',
      customArg: true,
      customLabel: true,
    }]
  },{
    action: 'stretch',
    args: [{
      name: 'Normal',
      arg: 0
    },{
      name: 'Basic',
      arg: 1,
    },{
      name: 'Hybrid',
      arg: 2,
    },{
      name: 'Thin borders',
      arg: 3,
    }],
    sitewide: true, // if true, you can see this in site settings
    global: true,   // if true, it can appear in extension settings
  },{
    action: 'align',
    args: [{
      name: 'Left',
      arg: 'left',
    },{
      name: 'Center',
      arg: 'center',
    },{
      name: 'Right',
      arg: 'right'
    }]
  }],
  // -----------------------------------------
  //             ::: ACTIONS :::
  // -----------------------------------------
  // Nastavitve za ukaze. Zamenja stare nastavitve za bližnične tipke.
  // 
  // Polje 'shortcut' je tabela, če se slučajno lotimo kdaj delati choordov. 
  actions: [{
    cmd: [{
      action: 'set-ar',
      arg: 'auto',
      persistent: false, // optional, false by default. If true, change doesn't take effect immediately.
                         // Instead, this action saves stuff to settings
    }],
    shortcut: [{
      key: 'a',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: true,
    popup_site: false,  // optional, false by default
    popup_global: false,// optional, false by default
    ui: true,
    label: 'Automatic'
  },{
    cmd: [{
      action: 'set-ar',
      arg: 'reset',
    }],
    shortcut: [{
      key: 'r',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: true,
    ui: true,
    label: 'Reset',
  },{
    cmd: [{
      action: 'set-ar',
      arg: 'fitw',
    }],
    shortcut: [{
      key: 'w',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: true,
    ui: true,
    label: 'Fit width',
  },{
    cmd: [{
      action: 'set-ar',
      arg: 'fith',
    }],
    shortcut: [{
      key: 'e',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: true,
    ui: true,
    label: 'Fit height',
  },{
    cmd: [{
      action: 'set-ar',
      arg: 1.78,
    }],
    shortcut: [{
      key: 's',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: false,
      onKeyDown: true,
    }],
    popup: true,
    ui: true,
    label: '16:9',
  },{
    cmd: [{
      action: 'set-ar',
      arg: 2.39,
    }],
    shortcut: [{
      key: 'd',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: false,
      onKeyDown: true,
    }],
    popup: true,
    ui: true,
    label: '21:9'
  },{
    cmd: [{
      action: 'set-ar',
      arg: 2.35,
    }],
    shortcut: [{
      key: 'q',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: false,
      onKeyDown: true,
    }],
    popup: true,
    ui: true,
    label: '2.35',
  },{
    cmd: [{
      action: 'set-ar',
      arg: 2.0,
    }],
    shortcut: [{
      key: 'x',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: true,
    ui: true,
    label: '18:9'
  },{
    cmd: [{
      action: 'set-zoom',
      arg: 0.1
    }],
    shortcut: [{
      key: 'z',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: false,
    ui: false,
    label: 'Zoom',
  },{
    cmd: [{
      action: 'set-zoom',
      arg: -0.1
    }],
    shortcut: [{
      key: 'u',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: false,
    ui: false,
    label: 'Unzoom',
  },{
    cmd: [{
      action: 'toggle-pan',
      arg: 'toggle'
    }],
    shortcut: [{
      key: 'p',
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: false,
      onKeyUp: true,
      onKeyDown: false,
    }],
    popup: true,
    ui: true,
    label: 'Toggle panning mode',
  },{
    cmd: [{
      action: 'pan',
      arg: 'toggle',
    }],
    shortcut: [{
      ctrlKey: false,
      metaKey: false,
      altKey: false, 
      shiftKey: true,
      onKeyDown: false,
      onKeyUp: false,
      onMouseMove: true,
    }],
    popup: false,
    ui: false,
    label: 'Pan (hold)'
  },
  //
  //   S T R E T C H I N G
  //
  {
    cmd: [{
      action: 'set-stretch',
      arg: 0,
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Normal',
  },{
    cmd: [{
      action: 'set-stretch',
      arg: 1,
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Basic'
  },{
    cmd: [{
      action: 'set-stretch',
      arg: 2,
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Hybrid'
  },{
    cmd: [{
      action: 'set-stretch',
      arg: 3,
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Thin borders'
  },{
    cmd: [{
      action: 'set-stretch',
      arg: -1,
    }],
    popup: false,
    popup_site: true,
    popup_global: false,
    ui: false,
    label: 'Default'
  },
  //
  //    A L I G N M E N T
  //
  {
    cmd: [{
      action: 'set-alignment',
      arg: 'left'
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Left',
  },{
    cmd: [{
      action: 'set-alignment',
      arg: 'center'
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Center',
  },{
    cmd: [{
      action: 'set-alignment',
      arg: 'right'
    }],
    popup: true,
    popup_site: true,
    popup_global: true,
    ui: true,
    label: 'Right',
  },{
    cmd: [{
      action: 'set-alignment',
      arg: 'default'
    }],
    popup: false,
    popup_site: true,
    popup_global: false,
    ui: false,
    label: 'Default',
  },
  //
  //    E N A B L E   E X T E N S I O N / A U T O A R
  //    (for sites/extension tab in the popup)
  //
  { // extension options:
    // global
    cmd: [{
      action: 'set-extension-mode',
      arg: 'blacklist',
      persistent: true,
    }],
    popup: false,
    popup_global: true,
    popup_site: false,
    ui: true,
    label: 'Enable'
  },{
    cmd: [{
      action: 'set-extension-mode',
      arg: 'whitelist',
      persistent: true,
    }],
    popup: false,
    popup_global: true,
    popup_site: false,
    ui: true,
    label: 'On whitelisted only'
  },{
    cmd: [{
      action: 'set-extension-mode',
      arg: 'disabled',
      persistent: true,
    }],
    popup: false,
    popup_global: true,
    popup_site: false,
    ui: true,
    label: 'Disabled'
  },{
    // site-only
    cmd: [{
      action: 'set-extension-mode',
      arg: 'whitelist',
      persistent: true,
    }],
    popup: false,
    popup_global: false,
    popup_site: true,
    ui: true,
    label: 'Enable'
  },{
    cmd: [{
      action: 'set-extension-mode',
      arg: 'default',
      persistent: true,
    }],
    popup: false,
    popup_global: false,
    popup_site: true,
    ui: true,
    label: 'Use default option'
  },{
    cmd: [{
      action: 'set-extension-mode',
      arg: 'disabled',
      persistent: true,
    }],
    popup: false,
    popup_global: false,
    popup_site: true,
    ui: true,
    label: 'Disable'
  },{ // extension options:
      // global
    cmd: [{
      action: 'set-autoar-mode',
      arg: 'blacklist',
      persistent: true,
    }],
    popup: false,
    popup_global: true,
    popup_site: false,
    ui: true,
    label: 'Enable'
  },{
    cmd: [{
      action: 'set-autoar-mode',
      arg: 'whitelist',
      persistent: true,
    }],
    popup: false,
    popup_global: true,
    popup_site: false,
    ui: true,
    label: 'On whitelisted only'
  },{
    cmd: [{
      action: 'set-autoar-mode',
      arg: 'disabled',
      persistent: true,
    }],
    popup: false,
    popup_global: true,
    popup_site: false,
    ui: true,
    label: 'Disabled'
  },{
    // site-only
    cmd: [{
      action: 'set-autoar-mode',
      arg: 'whitelist',
      persistent: true,
    }],
    popup: false,
    popup_global: false,
    popup_site: true,
    ui: true,
    label: 'Enable'
  },{
    
    cmd: [{
      action: 'set-autoar-mode',
      arg: 'default',
      persistent: true,
    }],
    popup: false,
    popup_global: false,
    popup_site: true,
    ui: true,
    label: 'Use default option'
  },{
    cmd: [{
      action: 'set-autoar-mode',
      arg: 'disabled',
      persistent: true,
    }],
    popup: false,
    popup_global: false,
    popup_site: true,
    ui: true,
    label: 'Disable'
  },],
  // -----------------------------------------
  //       ::: SITE CONFIGURATION :::
  // -----------------------------------------
  // Nastavitve za posamezno stran
  // Config for a given page:
  // 
  // <hostname> : {
  //    status: <option>              // should extension work on this site?
  //    arStatus: <option>            // should we do autodetection on this site?
  //    statusEmbedded: <option>      // reserved for future... maybe
  //    
  //    defaultAar?: <ratio>          // automatically apply this aspect ratio on this side. Use extension defaults if undefined.
  //    stretch? <stretch mode>       // automatically stretch video on this site in this manner
  //    videoAlignment? <left|center|right>
  //
  //    type: <official|community|user>  // 'official' — blessed by Tam. 
  //                                     // 'community' — blessed by reddit.
  //                                     // 'user' — user-defined (not here)
  //    override: <true|false>           // override user settings for this site on update
  // } 
  //  
  // Veljavne vrednosti za možnosti 
  // Valid values for options:
  //
  //     status, arStatus, statusEmbedded:
  //    
  //    * enabled     — always allow, full
  //    * basic       — allow, but only the basic version without playerData
  //    * default     — allow if default is to allow, block if default is to block
  //    * disabled    — never allow
  // 
  sites: {
    "www.youtube.com" : {
      status: "enabled",                // should extension work on this site?
      arStatus: "default",              // should we enable autodetection
      statusEmbedded: "enabled",        // should extension work for this site when embedded on other sites?
      override: false,                  // ignore value localStorage in favour of this
      type: 'official',                 // is officially supported? (Alternatives are 'community' and 'user-defined')
      actions: null,                    // overrides global keyboard shortcuts and button configs. Is array, is optional.
    },
    "www.netflix.com" : {
      status: "enabled",
      arStatus: BrowserDetect.firefox ? "default" : "disabled",
      statusEmbedded: "enabled",
      override: false,
      type: 'official'
    },
  }
}
