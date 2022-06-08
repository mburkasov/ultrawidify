import Debug from '../../conf/Debug';
import ExtensionMode from '../../../common/enums/ExtensionMode.enum'
import AspectRatioType from '../../../common/enums/AspectRatioType.enum';
import PlayerNotificationUi from '../uwui/PlayerNotificationUI';
import BrowserDetect from '../../conf/BrowserDetect';
import * as _ from 'lodash';
import { sleep } from '../../../common/js/utils';
import VideoData from './VideoData';
import Settings from '../Settings';
import Logger from '../Logger';
import EventBus from '../EventBus';
import UI from '../uwui/UI';

if (process.env.CHANNEL !== 'stable'){
  console.info("Loading: PlayerData.js");
}

interface PlayerDimensions {
  width?: number;
  height?: number;
  fullscreen?: boolean;
}

/**
 * accepts <video> tag (element) and list of names that can appear in id or class
 * returns player dimensions (width, height)
 * Theater mode is mildly broken on youtube. <video> tag remains bigger than the player after leaving the fullscreen mode, and
 * there's nothing we can do about that. This function aims to solve the problem by finding the player element that's wrapped around
 * the <video> tag.

 * In general, an outer tag should be bigger than the inner tag. Therefore the smallest element between <video> tag and the document
 * root should be the player.

 * If list of names is provided, the function returns dimensions of the first element that contains any name from the list in either
 * id or class.
 */

class PlayerData {
  private playerCssClass = 'uw-ultrawidify-player-css';

  //#region helper objects
  logger: Logger;
  videoData: VideoData;
  settings: Settings;
  notificationService: PlayerNotificationUi;
  eventBus: EventBus;
  //#endregion

  //#region HTML objects
  video: any;
  element: any;
  overlayNode: any;
  //#endregion

  //#region flags
  enabled: boolean;
  invalid: boolean = false;
  private periodicallyRefreshPlayerElement: boolean = false;
  halted: boolean = true;

  //#region misc stuff
  extensionMode: any;
  dimensions: PlayerDimensions;
  private playerIdElement: any;
  private observer: ResizeObserver;

  private ui: any;

  elementStack: any[] = [];
  //#endregion

  /**
   * Gets player aspect ratio. If in full screen, it returns screen aspect ratio unless settings say otherwise.
   */
  get aspectRatio() {
    try {
      if (this.dimensions?.fullscreen && !this.settings.getSettingsForSite()?.usePlayerArInFullscreen) {
        return window.innerWidth / window.innerHeight;
      }

      return this.dimensions.width / this.dimensions.height;
    } catch (e) {
      console.error('cannot determine aspect ratio!', e);
      return 1;
    }
  }

  constructor(videoData) {
    try {
      this.logger = videoData.logger;
      this.videoData = videoData;
      this.video = videoData.video;
      this.settings = videoData.settings;
      this.eventBus = videoData.eventBus;
      this.extensionMode = videoData.extensionMode;
      this.invalid = false;
      this.element = this.getPlayer();

      // this.notificationService = new PlayerNotificationUi(this.element, this.settings, this.eventBus);
      this.ui = new UI('ultrawidifyUi', {parentElement: this.element, eventBus: this.eventBus});
      // this.ui.init();

      this.dimensions = undefined;
      this.overlayNode = undefined;

      this.periodicallyRefreshPlayerElement = false;
      try {
        this.periodicallyRefreshPlayerElement = this.settings.active.sites[window.location.hostname].DOM.player.periodicallyRefreshPlayerElement;
      } catch (e) {
        // no biggie — that means we don't have any special settings for this site.
      }

      // this happens when we don't find a matching player element
      if (!this.element) {
        this.invalid = true;
        return;
      }

      if (this.extensionMode === ExtensionMode.Enabled) {
        this.trackDimensionChanges();
      }
      this.startChangeDetection();

    } catch (e) {
      console.error('[Ultrawidify::PlayerData::ctor] There was an error setting up player data. You should be never seeing this message. Error:', e);
      this.invalid = true;
    }

  }

  /**
   * Returns whether we're in fullscreen mode or not.
   */
  static isFullScreen(){
    const ihdiff = Math.abs(window.screen.height - window.innerHeight);
    const iwdiff = Math.abs(window.screen.width - window.innerWidth);

    // Chrome on linux on X on mixed PPI displays may return ever so slightly different values
    // for innerHeight vs screen.height abd innerWidth vs. screen.width, probably courtesy of
    // fractional scaling or something. This means we'll give ourself a few px of margin — the
    // window elements visible in not-fullscreen are usually double digit px tall
    return ( ihdiff < 5 && iwdiff < 5 );
  }

  /**
   *
   */
  trackDimensionChanges() {

    // get player dimensions _once_
    let currentPlayerDimensions;
    const isFullScreen = PlayerData.isFullScreen();

    if (isFullScreen) {
      currentPlayerDimensions = {
        width: window.innerWidth,
        height: window.innerHeight,
        fullscreen: true
      };
    } else {
      currentPlayerDimensions = {
        width: this.element.offsetWidth,
        height: this.element.offsetHeight,
        fullscreen: false,
      }
    }

    // if dimensions of the player box are the same as the last known
    // dimensions, we don't have to do anything
    if (
      this.dimensions
      && this.dimensions.width == currentPlayerDimensions.width
      && this.dimensions.height == currentPlayerDimensions.height
    ) {
      this.dimensions = currentPlayerDimensions;
      return;
    }

    // in every other case, we need to check if the player is still
    // big enough to warrant our extension running.

    this.handleSizeConstraints(currentPlayerDimensions);
    this.handleDimensionChanges(currentPlayerDimensions, this.dimensions);

    // Save current dimensions to avoid triggering this function pointlessly
    this.dimensions = currentPlayerDimensions;
  }


  /**
   * Handles size restrictions (if any)
   * @param currentPlayerDimensions
   */
  private handleSizeConstraints(currentPlayerDimensions: PlayerDimensions) {

    // never disable ultrawidify in full screen
    if (currentPlayerDimensions.fullscreen) {
      this.enable();
      return;
    }

    const restrictions = this.settings.getSettingsForSite()?.restrictions ?? this.settings.active?.restrictions;

    // if 'disable on small players' option is not enabled, the extension will run in any case
    if (!restrictions?.disableOnSmallPlayers) {
      this.enable();
      return;
    }

    // If we only allow ultrawidify in full screen, we disable it when not in full screen
    if (restrictions.onlyAllowInFullscreen && !currentPlayerDimensions.fullscreen) {
      this.disable();
      return;
    }

    // if current width or height are smaller than the minimum, the extension will not run
    if (restrictions.minAllowedHeight > currentPlayerDimensions?.height || restrictions.minAllowedWidth > currentPlayerDimensions?.width) {
      this.disable();
      return;
    }

    // in this case, the player is big enough to warrant enabling Ultrawidify
    this.enable();
  }


  private handleDimensionChanges(newDimensions: PlayerDimensions, oldDimensions: PlayerDimensions) {
    if (!this.enabled) {
      this.logger.log('info', 'debug', "[PlayerDetect] player size changed, but PlayerDetect is in disabled state. The player element is probably too small.");
      return;
    }

    // this 'if' is just here for debugging — real code starts later. It's safe to collapse and
    // ignore the contents of this if (unless we need to change how logging works)
    this.logger.log('info', 'debug', "[PlayerDetect] player size potentially changed.\n\nold dimensions:", oldDimensions, '\nnew dimensions:', newDimensions);

    // if size doesn't match, trigger onPlayerDimensionChange
    if (
      newDimensions?.width != oldDimensions?.width
      || newDimensions?.height != oldDimensions?.height
      || newDimensions?.fullscreen != oldDimensions?.fullscreen
    ){
      // If player size changes, we restore aspect ratio
      this.videoData.resizer?.restore();
    }
  }

  /**
   * Enables ultrawidify for this video by adding the relevant classes
   * to the video and player element.
   */
  enable() {
    this.enabled = true;
    this.element.classList.add(this.playerCssClass);
    this.startChangeDetection();
    this.videoData.enable({fromPlayer: true});
  }

  /**
   * Disables ultrawidify for this video by removing the relevant classes
   * from the video and player elements.
   *
   * NOTE: it is very important to keep change detection active while disabled,
   * because otherwise ultrawidify will otherwise remain inactive after
   * switching (back to) full screen.
   */
  disable() {
    this.enabled = false;
    this.element.classList.remove(this.playerCssClass);
    this.videoData.disable({fromPlayer: true});
  }


  onPlayerDimensionsChanged(mutationList?, observer?) {
    this.trackDimensionChanges();
  }

  destroy() {
    this.stopChangeDetection();
    this.destroyOverlay();
    this.notificationService?.destroy();
  }

  //#region player element change detection
  startChangeDetection(){
    if (this.invalid) {
      return;
    }

    try {
      if (BrowserDetect.firefox) {
        this.observer = new ResizeObserver(
          _.debounce(           // don't do this too much:
            this.onPlayerDimensionsChanged,
            250,                // do it once per this many ms
            {
              leading: true,    // do it when we call this fallback first
              trailing: true    // do it after the timeout if we call this callback few more times
            }
          )
        );
      } else {
        // Chrome for some reason insists that this.onPlayerDimensionsChanged is not a function
        // when it's not wrapped into an anonymous function
        this.observer = new ResizeObserver(
          _.debounce(           // don't do this too much:
            (m,o) => this.onPlayerDimensionsChanged(m,o),
            250,                // do it once per this many ms
            {
              leading: true,    // do it when we call this fallback first
              trailing: true    // do it after the timeout if we call this callback few more times
            }
          )
        );
      }

      const observerConf = {
        attributes: true,
        // attributeFilter: ['style', 'class'],
        attributeOldValue: true,
      };

      this.observer.observe(this.element);
    } catch (e) {
      console.error("failed to set observer",e )
    }
    // legacy mode still exists, but acts as a fallback for observers and is triggered less
    // frequently in order to avoid too many pointless checks
    this.legacyChangeDetection();
  }

  async legacyChangeDetection() {
    while (!this.halted) {
      await sleep(1000);
      try {
        this.forceRefreshPlayerElement();
      } catch (e) {
        console.error('[PlayerData::legacycd] this message is pretty high on the list of messages you shouldn\'t see', e);
      }
    }
  }

  doPeriodicPlayerElementChangeCheck() {
    if (this.periodicallyRefreshPlayerElement) {
      this.forceRefreshPlayerElement();
    }
  }

  stopChangeDetection(){
    this.observer.disconnect();
  }

  //#region interface
  makeOverlay() {
    if (!this.overlayNode) {
      this.destroyOverlay();
    }

    let overlay = document.createElement('div');
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.zIndex = '1000000000';
    overlay.style.pointerEvents = 'none';

    this.overlayNode = overlay;
    this.element.appendChild(overlay);
  }

  destroyOverlay() {
    if(this.playerIdElement) {
      this.playerIdElement.remove();
      this.playerIdElement = undefined;
    }
    if (this.overlayNode) {
      this.overlayNode.remove();
      this.overlayNode = undefined;
    }
  }

  markPlayer(name, color) {
    if (!this.overlayNode) {
      this.makeOverlay();
    }
    if (this.playerIdElement) {
      this.playerIdElement.remove();
    }
    this.playerIdElement = document.createElement('div');
    this.playerIdElement.innerHTML = `<div style="background-color: ${color}; color: #fff; position: absolute; top: 0; left: 0">${name}</div>`;

    this.overlayNode.appendChild(this.playerIdElement);
  }

  unmarkPlayer() {
    this.logger.log('info', 'debug', "[PlayerData::unmarkPlayer] unmarking player!", {playerIdElement: this.playerIdElement});
    if (this.playerIdElement) {
      this.playerIdElement.innerHTML = '';
      this.playerIdElement.remove();
    }
    this.playerIdElement = undefined;
  }
  //#endregion


  //#region helper functions
  collectionHas(collection, element) {
    for (let i = 0, len = collection.length; i < len; i++) {
      if (collection[i] == element) {
        return true;
      }
    }
    return false;
  }
  //#endregion

  /**
   * Finds and returns HTML element of the player
   */
  getPlayer(options?: {verbose?: boolean}) {
    const host = window.location.hostname;
    let element = this.video.parentNode;
    const videoWidth = this.video.offsetWidth;
    const videoHeight = this.video.offsetHeight;
    let playerCandidate;

    const elementStack: any[] = [{
      element: this.video,
      type: 'video'
    }];

    // first pass to generate the element stack and translate it into array
    while (element) {
      elementStack.push({
        element,
        tagName: element.tagName,
        classList: element.classList,
        id: element.id,
        width: element.offsetWidth,     // say no to reflows, don't do element.offset[width/height]
        height: element.offsetHeight,   // repeatedly ... let's just do it once at this spot
        heuristics: {},
      });
      element = element.parentElement;
    }
    this.elementStack = elementStack;

    if (this.settings.active.sites[host]?.DOM?.player?.manual) {
      if (this.settings.active.sites[host]?.DOM?.player?.useRelativeAncestor
        && this.settings.active.sites[host]?.DOM?.player?.videoAncestor) {
        playerCandidate = this.getPlayerParentIndex(elementStack);
      } else if (this.settings.active.sites[host]?.DOM?.player?.querySelectors) {
        playerCandidate = this.getPlayerQs(elementStack, videoWidth, videoHeight);
      }

      // if 'verbose' option is passed, we also populate the elementStack
      // with heuristics data for auto player detection.
      if (playerCandidate && !options?.verbose) {
        return playerCandidate;
      }
    }

    if (options?.verbose && playerCandidate) {
      // remember — we're only populating elementStack. If we found a player
      // element using manual methods, we will still return that element.
      this.getPlayerAuto(elementStack, videoWidth, videoHeight);
      return playerCandidate;
    } else {
      return this.getPlayerAuto(elementStack, videoWidth, videoHeight);
    }
  }

  private getPlayerAuto(elementStack: any[], videoWidth, videoHeight) {
    let penaltyMultiplier = 1;
    const sizePenaltyMultiplier = 0.1;
    const perLevelScorePenalty = 10;

    for (const element of elementStack) {

      // ignore weird elements, those would break our stuff
      if (element.width == 0 || element.height == 0) {
        element.heuristics['invalidSize'] = true;
        continue;
      }

      // element is player, if at least one of the sides is as long as the video
      // note that we can't make any additional assumptions with regards to player
      // size, since there are both cases where the other side is bigger _and_ cases
      // where other side is smaller than the video.
      //
      // Don't bother thinking about this too much, as any "thinking" was quickly
      // corrected by bugs caused by various edge cases.
      if (
        this.equalish(element.height, videoHeight, 5)
        || this.equalish(element.width, videoWidth, 5)
      ) {
        let score = 1000;

        // -------------------
        //     PENALTIES
        // -------------------
        //
        // Our ideal player will be as close to the video element, and it will als
        // be as close to the size of the video.

        const diffX = (element.width - videoWidth);
        const diffY = (element.height - videoHeight);

        // we have a minimal amount of grace before we start dinking scores for
        // mismatched dimensions. The size of the dimension mismatch dink is
        // proportional to area rather than circumference, meaning we multiply
        // x and y dinks instead of adding them up.
        let playerSizePenalty = 1;
        if (diffY > 5) {
          playerSizePenalty *= diffY * sizePenaltyMultiplier;
        }
        if (diffX > 5) {
          playerSizePenalty *= diffX * sizePenaltyMultiplier;
        }
        score -= playerSizePenalty;

        // we prefer elements closer to the video, so the score of each potential
        // candidate gets dinked a bit
        score -= perLevelScorePenalty * penaltyMultiplier;

        element.autoScore = score;
        element.heuristics['autoScoreDetails'] = {
          playerSizePenalty,
          diffX,
          diffY,
          penaltyMultiplier
        }

        // ensure next valid candidate is gonna have a harder job winning out
        penaltyMultiplier++;
      }
    }

    let bestCandidate: any = {autoScore: -99999999, initialValue: true};
    for (const element of elementStack) {
      if (element.autoScore > bestCandidate.autoScore) {
        bestCandidate = element;
      }
    }
    if (bestCandidate.initialValue) {
      bestCandidate = null;
    } else {
      bestCandidate = bestCandidate.element;
    }

    return bestCandidate;
  }

  private getPlayerQs(elementStack: any[], videoWidth, videoHeight) {
    const host = window.location.hostname;
    const perLevelScorePenalty = 10;
    let penaltyMultiplier = 0;

    const allSelectors = document.querySelectorAll(this.settings.active.sites[host].DOM.player.querySelectors);

    for (const element of elementStack) {
      if (this.collectionHas(allSelectors, element.element)) {
        let score = 100;

        // we award points to elements which match video size in one
        // dimension and exceed it in the other
        if (
          (element.width >= videoWidth && this.equalish(element.height, videoHeight, 2))
          || (element.height >= videoHeight && this.equalish(element.width, videoWidth, 2))
        ) {
          score += 75;
        }

        score -= perLevelScorePenalty * penaltyMultiplier;
        element.heuristics['qsScore'] = score;

        penaltyMultiplier++;
      }
    }

    let bestCandidate: any = {qsScore: -99999999, initialValue: true};
    for (const element of elementStack) {
      if (element.qsScore > bestCandidate.qsScore) {
        bestCandidate = element;
      }
    }
    if (bestCandidate.initialValue) {
      bestCandidate = null;
    } else {
      bestCandidate = bestCandidate.element;
    }

    return bestCandidate;
  }

  private getPlayerParentIndex(elementStack: any[]) {
    const host = window.location.hostname;
    elementStack[this.settings.active.sites[host].DOM.player.videoAncestor].heuristics['manualElementByParentIndex'] = true;
    return elementStack[this.settings.active.sites[host].DOM.player.videoAncestor].element;
  }

  equalish(a,b, tolerance) {
    return a > b - tolerance && a < b + tolerance;
  }

  forceRefreshPlayerElement() {
    this.element = this.getPlayer();
    // this.notificationService?.replace(this.element);
    this.trackDimensionChanges();
  }

  showNotification(notificationId) {
    // this.notificationService?.showNotification(notificationId);
  }

  /**
   * NOTE: this method needs to be deleted once Edge gets its shit together.
   */
  showEdgeNotification() {
    // if (BrowserDetect.isEdgeUA && !this.settings.active.mutedNotifications?.browserSpecific?.edge?.brokenDrm?.[window.hostname]) {
    //   this.ui = new PlayerUi(this.element, this.settings);
    // }
  }
}

if (process.env.CHANNEL !== 'stable'){
  console.info("PlayerData loaded");
}

export default PlayerData;
