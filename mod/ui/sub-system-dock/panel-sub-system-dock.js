// Civ 7 Archipelago: depth-aware tree rendering, copied verbatim
// from SeelingCat's "Et Cetera" Workshop mod (id 3553557269).
// Et Cetera implements the per-tier LOC fallback pattern
// (`<base name LOC>_<tier>`) that lets mastery tiers display
// distinct text - the exact mechanism the AP companion's
// per-seed text overrides depend on. The patches span multiple
// UI files (tooltip, card, chooser screens, completion popup,
// sub-system-dock) and only work as a coherent bundle.
//
// Original author: SeelingCat. Source: Civ 7 Steam Workshop.
//
import ContextManager from 'fs://game/core/ui/context-manager/context-manager.js';
import { a as DialogBoxManager } from 'fs://game/core/ui/dialog-box/manager-dialog-box.chunk.js';
import FocusManager from 'fs://game/core/ui/input/focus-manager.js';
import { ModdingRegistry } from 'fs://game/core/ui/modding-registry-handler/modding-registry-handler.js';
import { P as Panel, A as AnchorType } from 'fs://game/core/ui/panel-support.chunk.js';
import { Icon } from 'fs://game/core/ui/utilities/utilities-image.chunk.js';
import PopupSequencer from 'fs://game/base-standard/ui/popup-sequencer/popup-sequencer.js';
import 'fs://game/core/ui/context-manager/display-queue-manager.js';
import 'fs://game/core/ui/framework.chunk.js';
import 'fs://game/core/ui/input/cursor.js';
import 'fs://game/core/ui/views/view-manager.chunk.js';
import 'fs://game/core/ui/audio-base/audio-support.chunk.js';
import 'fs://game/core/ui/utilities/utilities-dom.chunk.js';
import 'fs://game/core/ui/utilities/utilities-component-id.chunk.js';

const styles = "fs://game/base-standard/ui/sub-system-dock/panel-sub-system-dock.css";

console.log("ET CETERA SUBSYSTEM DOCK IS LOADED")

class PanelSubSystemDock extends Panel {
  buttonContainer = document.createElement("fxs-hslot");
  ageRing = null;
  ageTurnCounter = null;
  cultureButton = null;
  cultureRing = null;
  cultureTurnCounter = null;
  techButton = null;
  techRing = null;
  techTurnCounter = null;
  goldenAgeCrown;
  policiesButton = null;
  policiesTurnCounter;
  resourcesButton = null;
  focusSubsystemListener = this.onFocusSubsystem.bind(this);
  onInitialize() {
    super.onInitialize();
    const fragment = document.createDocumentFragment();
    this.buttonContainer.setAttribute("focus-rule", "last");
    this.buttonContainer.setAttribute("ignore-prior-focus", "");
    this.buttonContainer.classList.add("flow-row", "sub-system-dock--button-container");
    fragment.appendChild(this.buttonContainer);
    this.animateInType = this.animateOutType = AnchorType.Fade;
    if (this.ageNeverEnds) {
      const ageElements = this.addRingButton({
        useCrisisMeter: false,
        tooltip: "LOC_UI_VICTORY_PROGRESS",
        callback: this.openRankings,
        class: ["ring-age", "tut-age"],
        ringClass: "ssb__texture-ring",
        modifierClass: "ageextended",
        audio: "age-progress",
        focusedAudio: "data-audio-focus-large"
      });
      this.ageRing = ageElements.ring;
      this.ageTurnCounter = ageElements.turnCounter;
    } else {
      const ageElements = this.addRingButton({
        useCrisisMeter: true,
        tooltip: "LOC_UI_VICTORY_PROGRESS",
        callback: this.openRankings,
        class: ["ring-age", "tut-age"],
        ringClass: "ssb__texture-ring",
        modifierClass: "agetimer",
        audio: "age-progress",
        focusedAudio: "data-audio-focus-large"
      });
      this.ageRing = ageElements.ring;
      this.ageTurnCounter = ageElements.turnCounter;
    }
    const techElements = this.addRingButton({
      tooltip: "LOC_UI_VIEW_TECH_TREE",
      callback: this.openTechChooser,
      class: ["ring-tech", "tut-tech"],
      ringClass: "ssb__texture-ring",
      modifierClass: "tech",
      audio: "tech-tree",
      focusedAudio: "data-audio-focus-large"
    });
    this.techButton = techElements.button;
    this.techRing = techElements.ring;
    this.techTurnCounter = techElements.turnCounter;
    const cultureElements = this.addRingButton({
      tooltip: "LOC_UI_VIEW_CIVIC_TREE",
      callback: this.openCultureChooser,
      class: ["ring-culture", "tut-culture"],
      ringClass: "ssb__texture-ring",
      modifierClass: "civic",
      audio: "culture-tree",
      focusedAudio: "data-audio-focus-large"
    });
    this.cultureButton = cultureElements.button;
    this.cultureRing = cultureElements.ring;
    this.cultureTurnCounter = cultureElements.turnCounter;
    this.policiesTurnCounter = this.createTurnCounter(true);
    this.policiesButton = this.addButton({
      tooltip: "LOC_UI_VIEW_TRADITIONS",
      modifierClass: "gov",
      callback: this.onOpenPolicies.bind(this),
      class: "tut-traditions",
      audio: "government",
      focusedAudio: "data-audio-focus-small",
      turnCounter: this.policiesTurnCounter
    });
    this.goldenAgeCrown = document.createElement("div");
    this.goldenAgeCrown.classList.add(
      "sub-system-dock--golden-age-ring",
      "absolute",
      "-inset-4",
      "bg-no-repeat",
      "bg-cover",
      "hidden"
    );
    this.policiesButton.appendChild(this.goldenAgeCrown);
    this.resourcesButton = this.addButton({
      tooltip: "LOC_UI_VIEW_RESOURCE_ALLOCATION",
      modifierClass: "resources",
      callback: this.onOpenResourceAllocation.bind(this),
      class: "tut-trade",
      audio: "resources",
      focusedAudio: "data-audio-focus-small"
    });
    this.addButton({
      tooltip: "LOC_UI_VIEW_GREAT_WORKS",
      modifierClass: "greatworks",
      callback: this.onOpenGreatWorks.bind(this),
      class: "tut-great-works",
      audio: "great-works",
      focusedAudio: "data-audio-focus-small"
    });
    if (Game.age != Database.makeHash("AGE_MODERN")) {
      this.addButton({
        tooltip: "LOC_UI_VIEW_RELIGION",
        modifierClass: "religion",
        callback: this.openReligionViewer.bind(this),
        class: "tut-religion",
        audio: "religion",
        focusedAudio: "data-audio-focus-small"
      });
    }
    this.addButton({
      tooltip: "LOC_UI_VIEW_UNLOCKS",
      modifierClass: "unlocks",
      callback: this.onOpenUnlocks.bind(this),
      class: "tut-unlocks",
      audio: "unlocks",
      focusedAudio: "data-audio-focus-small"
    });
    this.attachAdditionalInfo(this.resourcesButton, null);
    this.updateButtonTimers();
    const moddingButtonContainer = document.createElement("fxs-hslot");
    moddingButtonContainer.id = "panel-sub-system-dock-mod-slot";
    this.buttonContainer.appendChild(moddingButtonContainer);
    this.Root.appendChild(fragment);
  }
  onAttach() {
    super.onAttach();
    this.Root.listenForEngineEvent("PlayerTurnActivated", this.onPlayerTurnBegin, this);
    this.Root.listenForEngineEvent("PlayerTurnDeactivated", this.onPlayerTurnEnd, this);
    this.Root.listenForEngineEvent("ScienceYieldChanged", this.onTechsUpdated, this);
    this.Root.listenForEngineEvent("TechTreeChanged", this.onTechsUpdated, this);
    this.Root.listenForEngineEvent("TechTargetChanged", this.onTechTargetUpdated, this);
    this.Root.listenForEngineEvent("TechNodeCompleted", this.onTechsUpdated, this);
    this.Root.listenForEngineEvent("PlayerYieldChanged", this.onPlayerYieldUpdated, this);
    this.Root.listenForEngineEvent("PlayerYieldGranted", this.onPlayerYieldGranted, this);
    this.Root.listenForEngineEvent("CultureYieldChanged", this.onCultureUpdated, this);
    this.Root.listenForEngineEvent("CultureTreeChanged", this.onCultureUpdated, this);
    this.Root.listenForEngineEvent("CultureTargetChanged", this.onCultureTargetUpdated, this);
    this.Root.listenForEngineEvent("CultureNodeCompleted", this.onCultureUpdated, this);
    this.Root.listenForEngineEvent("AgeProgressionChanged", this.updateAgeProgression, this);
    this.Root.listenForEngineEvent("PlayerGoldenAgeChanged", this.onGoldenAgeChanged, this);
    this.Root.listenForEngineEvent("ResourceAssigned", this.updateResourcesButton, this);
    this.Root.listenForEngineEvent("PlotOwnershipChanged", this.updateResourcesButton, this);
    this.Root.listenForEngineEvent("GameExtended", this.onGameExtended, this);
    this.Root.listenForWindowEvent("focus-sub-system", this.focusSubsystemListener);
    ModdingRegistry.attachModElements("panel-sub-system-dock");
  }
  onDetach() {
    super.onDetach();
  }
  generateOpenCallbacks(callbacks) {
    callbacks["screen-culture-tree-chooser"] = this.openCultureChooser;
    callbacks["screen-victory-progress"] = this.openRankings;
    callbacks["screen-tech-tree-chooser"] = this.openTechChooser;
    callbacks["screen-policies"] = this.onOpenPolicies;
    callbacks["screen-great-works"] = this.onOpenGreatWorks;
    callbacks["screen-resource-allocation"] = this.onOpenResourceAllocation;
    callbacks["screen-unlocks"] = this.onOpenUnlocks;
    const religionScreen = this.getReligionScreenName();
    callbacks["screen-pantheon-chooser"] = religionScreen == "screen-pantheon-chooser" ? this.openReligionViewer : void 0;
    callbacks["panel-pantheon-complete"] = religionScreen == "panel-pantheon-complete" ? this.openReligionViewer : void 0;
    callbacks["panel-religion-picker"] = religionScreen == "panel-religion-picker" ? this.openReligionViewer : void 0;
    callbacks["panel-belief-picker"] = religionScreen == "panel-belief-picker" ? this.openReligionViewer : void 0;
  }
  createTurnCounter(isForPolicyButton) {
    const turnCounter = document.createElement("div");
    turnCounter.classList.add("ssb-button__turn-counter");
    turnCounter.setAttribute("data-tut-highlight", "founderHighlight");
    turnCounter.classList.toggle("ssb-button__turn-counter__policies", isForPolicyButton);
    turnCounter.classList.toggle("flex", isForPolicyButton);
    const turnCounterContent = document.createElement("div");
    turnCounterContent.classList.add("ssb-button__turn-counter-content", "font-title-base");
    turnCounter.appendChild(turnCounterContent);
    return turnCounter;
  }
  addRingButton(buttonData, index) {
    const turnCounter = this.createTurnCounter(false);
    const ringAndButton = {
      button: this.createButton(buttonData),
      ring: this.createRing(buttonData),
      turnCounter
    };
    ringAndButton.button.setAttribute("data-audio-group-ref", "audio-panel-sub-system-dock");
    ringAndButton.button.setAttribute("data-audio-press-ref", "data-audio-press-large");
    ringAndButton.button.setAttribute("data-audio-activate-ref", "none");
    if (index == null) {
      this.buttonContainer.appendChild(ringAndButton.ring);
    } else {
      const beforeNode = this.buttonContainer.childNodes[index];
      if (beforeNode) {
        this.buttonContainer.insertBefore(ringAndButton.ring, beforeNode);
      } else {
        this.buttonContainer.appendChild(ringAndButton.ring);
      }
    }
    ringAndButton.ring.appendChild(ringAndButton.button);
    ringAndButton.ring.appendChild(ringAndButton.turnCounter);
    if (buttonData.ringClass) {
      ringAndButton.ring.setAttribute("ring-class", buttonData.ringClass);
    }
    const highlightObj = document.createElement("div");
    highlightObj.classList.add("ssb-button__highlight", "absolute");
    highlightObj.setAttribute("data-tut-highlight", "founderHighlight");
    ringAndButton.button.appendChild(highlightObj);
    ringAndButton.ring.classList.add("ssb__element");
    return ringAndButton;
  }
  addButton(buttonData) {
    const button = this.createButton(buttonData);
    button.classList.add("ssb__element");
    this.buttonContainer.appendChild(button);
    return button;
  }
  createRing(buttonData) {
    const tag = buttonData.useCrisisMeter ? "crisis-meter" : "fxs-ring-meter";
    const ring = document.createElement(tag);
    if (buttonData.class) {
      Array.isArray(buttonData.class) ? ring.classList.add(...buttonData.class) : ring.classList.add(buttonData.class);
    }
    ring.classList.add(buttonData.modifierClass);
    return ring;
  }
  createButton(buttonData) {
    const button = document.createElement("fxs-activatable");
    {
      if (buttonData.turnCounter != void 0) {
        button.append(buttonData.turnCounter);
      }
      button.classList.add("ssb__button", buttonData.modifierClass);
      button.setAttribute("data-tut-highlight", "founderHighlight");
      Array.isArray(buttonData.class) ? button.classList.add(...buttonData.class) : button.classList.add(buttonData.class);
      button.setAttribute("data-tooltip-content", Locale.compose(buttonData.tooltip));
      button.setAttribute("data-audio-group-ref", "audio-panel-sub-system-dock");
      button.setAttribute("data-audio-focus-ref", buttonData.focusedAudio ?? "data-audio-focus");
      button.setAttribute("data-audio-activate-ref", "none");
      if (buttonData.audio) {
        button.setAttribute("data-audio-press-ref", "data-audio-press-small");
      }
      button.addEventListener("action-activate", (_event) => {
        buttonData.callback();
        FocusManager.clearFocus(button);
      });
      const buttonIconBg = document.createElement("div");
      {
        buttonIconBg.classList.add("ssb__button-iconbg", buttonData.modifierClass);
      }
      button.appendChild(buttonIconBg);
      const buttonIconBgHover = buttonIconBg.cloneNode();
      {
        buttonIconBgHover.classList.add("ssb__button-iconbg--hover");
      }
      button.appendChild(buttonIconBgHover);
      const buttonIconBgActive = buttonIconBg.cloneNode();
      {
        buttonIconBgActive.classList.add("ssb__button-iconbg--active");
      }
      button.appendChild(buttonIconBgActive);
      const buttonIconBgDisabled = buttonIconBg.cloneNode();
      {
        buttonIconBgDisabled.classList.add("ssb__button-iconbg--disabled");
      }
      button.appendChild(buttonIconBgDisabled);
      const buttonIcon = document.createElement("div");
      {
        buttonIcon.classList.add("ssb__button-icon", buttonData.modifierClass);
      }
      button.appendChild(buttonIcon);
    }
    return button;
  }
  attachAdditionalInfo(button, iconClass) {
    const progressMeter = document.createElement("div");
    progressMeter.classList.add("progress-meter");
    button.appendChild(progressMeter);
    const infoContainer = document.createElement("div");
    infoContainer.classList.add("ssb__info-container");
    const nameText = document.createElement("div");
    nameText.classList.add("ssb__info-name");
    infoContainer.appendChild(nameText);
    const textContainer = document.createElement("div");
    textContainer.classList.add("ssb__turn");
    if (iconClass) {
      const timerIcon = document.createElement("div");
      timerIcon.classList.add(iconClass);
      textContainer.appendChild(timerIcon);
    }
    const text = document.createElement("div");
    text.classList.add("ssb__turn-number");
    textContainer.appendChild(text);
    infoContainer.appendChild(textContainer);
    button.appendChild(infoContainer);
  }
  /**
   * Update the label found beneath the progress meter, tech research meter, and the civics meter.
   * @param element The HTML element with a "turn-counter-content" label to modify.
   * @param amount A floor'd number or string value to put in label.
   */
  updateProgressLabel(element, amount) {
    if (!element) {
      console.error(
        "panel-sub-system-dock: Unable to find turn counter element, skipping update of turn counter"
      );
      return;
    }
    const content = element.querySelector(".ssb-button__turn-counter-content");
    if (content) {
      content.textContent = amount.toString();
    }
    element.classList.toggle("hidden", amount == 0 || amount == "");
  }
  updateButtonIcon(element, icon) {
    const iconElement = element.querySelector(".ssb__button-icon");
    if (iconElement) {
      if (icon === "") {
        iconElement.style.removeProperty("background-image");
      } else {
        iconElement.style.backgroundImage = `url('${icon}')`;
      }
    }
  }
  updateButtonTimers() {
    this.updateAgeButtonTimer();
    this.updateCultureButtonTimer();
    this.updateTechButtonTimer();
    this.updateResourcesButton();
    this.updatePoliciesStructure();
  }
  updateCultureButtonTimer() {
    if (!this.cultureButton) {
      console.error("panel-sub-system-dock: Unable to find culture button, skipping update of turn timer");
      return;
    }
    const localPlayerID = GameContext.localPlayerID;
    const localPlayer = Players.getEverAlive()[GameContext.localPlayerID];
    if (localPlayer == null) {
      return;
    }
    let cultureTimer = 0;
    let cultureTooltipString = "";
    let cultureIcon = "";
    let cultureProgressRatio = 100;
    let cultureNameString = "";
    const culture = localPlayer.Culture;
    if (culture) {
      const activeCultureTreeType = culture.getActiveTree();
      const treeObject = Game.ProgressionTrees.getTree(
        localPlayerID,
        activeCultureTreeType
      );
      if (treeObject && treeObject.activeNodeIndex >= 0) {
        const activeNode = treeObject.nodes[treeObject.activeNodeIndex];
        const nodeData = Game.ProgressionTrees.getNode(
          localPlayerID,
          activeNode.nodeType
        );
        if (nodeData) {
          const nodeInfo = GameInfo.ProgressionTreeNodes.lookup(
            nodeData.nodeType
          );
          if (nodeInfo) {
            //SeelingCat
            cultureNameString = nodeInfo.Name ?? nodeInfo.ProgressionTreeNodeType;
            if (nodeData.depthUnlocked >= 1) {
                let depthNumeral = nodeData.depthUnlocked + 1;
                if (depthNumeral) {
                    if (Locale.keyExists(cultureNameString + "_" + depthNumeral)) {
                        cultureNameString += "_" + depthNumeral
                        cultureNameString = Locale.compose(cultureNameString) + " (" + Locale.compose("LOC_UI_TREE_MASTERY") + ")"
                    }
                    else {
                        console.log("CANT FIND STRING FOR ", cultureNameString, "_", depthNumeral)
                        cultureNameString = Locale.compose(cultureNameString)
                        depthNumeral = Locale.toRomanNumeral(nodeData.depthUnlocked + 100)
                        cultureNameString += " " + depthNumeral
                    }
                }
            }
            const cost = culture.getNodeCost(culture.getResearching().type);
            cultureIcon = Icon.getCultureIconFromProgressionTreeNodeDefinition(nodeInfo);
            cultureTimer = culture.getTurnsLeft();
            cultureTooltipString = Locale.compose(
              "LOC_SUB_SYSTEM_CULTURE_CURRENT_RESEARCH",
              cultureNameString,
              cultureTimer
            );
            cultureProgressRatio = 1 - nodeData.progress / cost;
            // SeelingCat
          }
        }
      }
    } else {
      console.error(
        "panel-sub-system-dock: unable to find local player culture, skipping update of culture button timer."
      );
    }
    this.updateProgressLabel(this.cultureTurnCounter, cultureTimer.toString());
    this.updateButtonIcon(this.cultureButton, cultureIcon);
    if (cultureTooltipString != "") {
      this.cultureButton.setAttribute("data-tooltip-content", cultureTooltipString);
    } else {
      this.cultureButton.setAttribute("data-tooltip-content", "LOC_SUB_SYSTEM_CULTURE_NO_RESEARCH");
    }
    this.cultureRing?.setAttribute("value", (100 - cultureProgressRatio * 100).toString());
  }
  updateAgeButtonTimer() {
    if (!this.ageRing) {
      console.error("panel-sub-system-dock: Unable to find age ring, skipping update of turn timers");
      return;
    }
    const ageName = GameInfo.Ages.lookup(Game.age)?.Name ?? "";
    const ageProgress = Game.AgeProgressManager.getCurrentAgeProgressionPoints();
    const maxAgeProgress = Game.AgeProgressManager.getMaxAgeProgressionPoints();
    if (this.ageNeverEnds) {
      this.ageRing.removeAttribute("data-tooltip-content");
    } else {
      const ageCountdownStarted = Game.AgeProgressManager.ageCountdownStarted;
      let tooltipString = Locale.compose(
        "LOC_ACTION_PANEL_CURRENT_AGE_PROGRESS",
        ageName,
        ageProgress,
        maxAgeProgress
      );
      if (ageCountdownStarted) {
        const curAgeProgress = Game.AgeProgressManager.getCurrentAgeProgressionPoints();
        const maxAgeProgress2 = Game.AgeProgressManager.getMaxAgeProgressionPoints();
        const ageProgressLeft = maxAgeProgress2 - curAgeProgress;
        if (ageProgressLeft == 0) {
          tooltipString += `[n]${Locale.compose("LOC_UI_GAME_FINAL_TURN_OF_AGE")}`;
        } else {
          tooltipString += `[n]${Locale.compose("LOC_UI_X_TURNS_LEFT_UNTIL_AGE_END", ageProgressLeft)}`;
        }
      }
      this.ageRing.setAttribute("data-tooltip-content", tooltipString);
    }
    this.updateVictoryMeter(ageProgress);
  }
  updateVictoryMeter(victoryProgression) {
    if (this.ageNeverEnds) {
      this.ageRing?.setAttribute("min-value", "0");
      this.ageRing?.setAttribute("max-value", "0");
      this.ageRing?.setAttribute("value", "0");
      this.updateProgressLabel(this.ageTurnCounter, "∞");
    } else {
      const maxAgeProgress = Game.AgeProgressManager.getMaxAgeProgressionPoints();
      this.ageRing?.setAttribute("min-value", "0");
      this.ageRing?.setAttribute("max-value", maxAgeProgress.toString());
      this.ageRing?.setAttribute("value", victoryProgression.toString());
      const ageProgressPercent = Locale.toPercent(victoryProgression / maxAgeProgress);
      this.updateProgressLabel(this.ageTurnCounter, ageProgressPercent);
    }
  }
  updateAgeProgression(data) {
    this.updateVictoryMeter(data.progressionTotal);
    if (Players.isValid(GameContext.localPlayerID)) {
      if (data.ageIsEnding != void 0 && data.ageIsEnding) {
        const popupBody = Locale.stylize("LOC_UI_GAME_ENDING_SOON_SUMMARY");
        DialogBoxManager.createDialog_Confirm({
          body: popupBody,
          title: "LOC_UI_GAME_ENDING_SOON_TITLE"
        });
      }
    }
  }
  updateTechButtonTimer() {
    if (!this.techButton) {
      console.error("panel-sub-system-dock: Unable to find tech button, skipping update of turn timers");
      return;
    }
    const localPlayerID = GameContext.localPlayerID;
    const localPlayer = Players.getEverAlive()[GameContext.localPlayerID];
    if (localPlayer == null) {
      return;
    }
    let techTimer = 0;
    let techTooltipString = "";
    let techIcon = "";
    let techProgressRatio = 100;
    let techNameString = "";
    const techs = localPlayer.Techs;
    if (techs) {
      const techTreeType = techs.getTreeType();
      const treeObject = Game.ProgressionTrees.getTree(localPlayerID, techTreeType);
      if (treeObject && treeObject.activeNodeIndex >= 0) {
        const activeNode = treeObject.nodes[treeObject.activeNodeIndex];
        const nodeData = Game.ProgressionTrees.getNode(localPlayerID, activeNode.nodeType);
        if (nodeData) {
          const nodeInfo = GameInfo.ProgressionTreeNodes.lookup(activeNode.nodeType);
          if (nodeInfo) {
            //SeelingCat
            techNameString = nodeInfo.Name ?? nodeInfo.ProgressionTreeNodeType;
            if (nodeData.depthUnlocked >= 1) {
                let depthNumeral = nodeData.depthUnlocked + 1;
                if (depthNumeral) {
                    if (Locale.keyExists(techNameString + "_" + depthNumeral)) {
                        techNameString += "_" + depthNumeral
                        techNameString = Locale.compose(techNameString) + " (" + Locale.compose("LOC_UI_TREE_MASTERY") + ")"
                    }
                    else {
                        console.log("CANT FIND STRING FOR ", techNameString, "_", depthNumeral)
                        techNameString = Locale.compose(techNameString)
                        depthNumeral = Locale.toRomanNumeral(nodeData.depthUnlocked + 1)
                        techNameString += " " + depthNumeral
                    }
                }
            }
            const cost = techs.getNodeCost(techs.getResearching().type);
            techIcon = Icon.getTechIconFromProgressionTreeNodeDefinition(nodeInfo);
            techTimer = techs.getTurnsLeft();
            techTooltipString = Locale.compose(
              "LOC_SUB_SYSTEM_TECH_CURRENT_RESEARCH",
              techNameString,
              techTimer
            );
            techProgressRatio = 1 - nodeData.progress / cost;
          }
        }
      }
    }
    this.updateProgressLabel(this.techTurnCounter, techTimer.toString());
    this.updateButtonIcon(this.techButton, techIcon);
    if (techTooltipString != "") {
      this.techButton.setAttribute("data-tooltip-content", techTooltipString);
    } else {
      this.techButton.setAttribute("data-tooltip-content", "LOC_SUB_SYSTEM_TECH_NO_RESEARCH");
    }
    this.techRing?.setAttribute("value", (100 - techProgressRatio * 100).toString());
  }
  /**
   * Update the policies structure, including the tooltip, the turn counter, and the golden age crown.
   */
  updatePoliciesStructure() {
    const localPlayer = Players.get(GameContext.localPlayerID);
    if (!localPlayer) {
      console.error("panel-sub-system-dock: createTraditionsTooltip() - No local player!");
      return;
    }
    const localPlayerHappiness = localPlayer.Happiness;
    if (localPlayerHappiness == void 0) {
      console.error("panel-sub-system-dock: createTraditionsTooltip() - No local player happiness!");
      return;
    }
    const localPlayerStats = localPlayer?.Stats;
    if (localPlayerStats === void 0) {
      console.error("panel-sub-system-dock: createTraditionsTooltip() - Local player stats is undefined!");
      return;
    }
    if (localPlayerHappiness.isInGoldenAge()) {
      this.goldenAgeCrown.classList.remove("hidden");
      const goldenAgeTurnsLeft = localPlayerHappiness.getGoldenAgeTurnsLeft();
      const goldenAgeType = localPlayerHappiness.getCurrentGoldenAge();
      const celebrationItemDef = GameInfo.GoldenAges.lookup(goldenAgeType);
      if (celebrationItemDef) {
        const description = Locale.compose(celebrationItemDef.Description, goldenAgeTurnsLeft);
        const tooltipContent = Locale.stylize(
          "LOC_SUB_SYSTEM_TRADITIONS_DURING_CELEBRATION",
          celebrationItemDef.Name,
          goldenAgeTurnsLeft,
          description
        );
        this.policiesButton?.setAttribute("data-tooltip-content", tooltipContent);
      } else {
        this.policiesButton?.setAttribute(
          "data-tooltip-content",
          Locale.compose("LOC_SUB_SYSTEM_TRADITIONS_TURNS_UNTIL_CELEBRATION_END", goldenAgeTurnsLeft)
        );
      }
      const displayPoliciesTurnCounter = goldenAgeTurnsLeft > 0 && goldenAgeTurnsLeft < Infinity;
      this.policiesTurnCounter?.classList.toggle("ssb-button__turn-counter-hidden", !displayPoliciesTurnCounter);
      this.updateProgressLabel(this.policiesTurnCounter, goldenAgeTurnsLeft);
      this.policiesTurnCounter.classList.add(
        "sub-system-dock--golden-age-timer-bg",
        "ssb-button__turn-counter_policies-celebration"
      );
      this.policiesTurnCounter?.classList.toggle(
        "ssb-button__turn-counter-wide",
        goldenAgeTurnsLeft >= 10 && goldenAgeTurnsLeft < Infinity
      );
    } else {
      this.goldenAgeCrown.classList.add("hidden");
      const happinessPerTurn = localPlayerStats.getNetYield(YieldTypes.YIELD_HAPPINESS) ?? -1;
      const nextGoldenAgeThreshold = localPlayerHappiness.nextGoldenAgeThreshold;
      const happinessTotal = Math.ceil(localPlayerStats.getLifetimeYield(YieldTypes.YIELD_HAPPINESS)) ?? -1;
      const turnsToNextGoldenAge = Math.max(
        1,
        Math.ceil((nextGoldenAgeThreshold - happinessTotal) / happinessPerTurn)
      );
      this.policiesButton?.setAttribute(
        "data-tooltip-content",
        Locale.compose("LOC_SUB_SYSTEM_TRADITIONS_TURNS_UNTIL_CELEBRATION_START", turnsToNextGoldenAge)
      );
      const displayPoliciesTurnCounter = turnsToNextGoldenAge < Infinity;
      this.policiesTurnCounter?.classList.remove("sub-system-dock--golden-age-timer-bg");
      this.policiesTurnCounter?.classList.remove("ssb-button__turn-counter_policies-celebration");
      this.policiesTurnCounter?.classList.toggle("ssb-button__turn-counter-hidden", !displayPoliciesTurnCounter);
      this.policiesTurnCounter?.classList.toggle(
        "ssb-button__turn-counter-wide",
        turnsToNextGoldenAge >= 10 && turnsToNextGoldenAge < Infinity
      );
      if (displayPoliciesTurnCounter) {
        this.updateProgressLabel(this.policiesTurnCounter, turnsToNextGoldenAge);
      }
    }
  }
  updateResourcesButton() {
    if (!this.resourcesButton) {
      console.error("panel-sub-system-dock: Unable to find resources button, skipping update of turn timers");
      return;
    }
    const localPlayer = Players.getEverAlive()[GameContext.localPlayerID];
    if (localPlayer == null) {
      return;
    }
    const playerResources = localPlayer.Resources;
    if (!playerResources) {
      console.error(
        `panel-sub-system-dock: updateResourcesButton - Failed to retrieve Resources for Player ${GameContext.localPlayerID}`
      );
      return;
    }
    let availableCount = 0;
    availableCount = playerResources.getCountResourcesToAssign();
    const resourcesTimerElement = this.resourcesButton.querySelector(".ssb__turn-number");
    if (resourcesTimerElement) {
      resourcesTimerElement.style.display = availableCount > 0 ? "flex" : "none";
      resourcesTimerElement.innerHTML = availableCount.toString();
    } else {
      console.error(
        "panel-sub-system-dock: updateResourcesButton(): Missing resourcesTimerElement with '.ssb__turn-number'"
      );
    }
  }
  // NOTE: The "PlayerYieldChanged" engine event, which this function is a callback for, is not currently connected to GameCore.
  onPlayerYieldUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.playerYieldChanged(data.yield);
  }
  onPlayerYieldGranted(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.playerYieldChanged(data.yield);
  }
  playerYieldChanged(YieldGranted) {
    switch (YieldGranted) {
      case YieldTypes.YIELD_CULTURE:
        this.updateCultureButtonTimer();
        break;
      case YieldTypes.YIELD_SCIENCE:
        this.updateTechButtonTimer();
        break;
      case YieldTypes.YIELD_HAPPINESS:
        this.updatePoliciesStructure();
        break;
    }
  }
  onTechsUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.updateTechButtonTimer();
  }
  onTechTargetUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.updateTechButtonTimer();
  }
  onCultureUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.updateCultureButtonTimer();
  }
  onCultureTargetUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.updateCultureButtonTimer();
  }
  onPlayerTurnEnd(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
  }
  onPlayerTurnBegin(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    this.updateButtonTimers();
  }
  onGameExtended(_data) {
    const ring = this.ageRing;
    if (ring) {
      ring.remove();
      this.ageRing = null;
      this.ageTurnCounter = null;
    }
    const ageElements = this.addRingButton(
      {
        useCrisisMeter: false,
        tooltip: "LOC_UI_VICTORY_PROGRESS",
        callback: this.openRankings,
        class: ["ring-age", "tut-age"],
        ringClass: "ssb__texture-ring",
        modifierClass: "ageextended",
        audio: "age-progress",
        focusedAudio: "data-audio-focus-large"
      },
      0
    );
    this.ageRing = ageElements.ring;
    this.ageTurnCounter = ageElements.turnCounter;
    this.updateAgeButtonTimer();
  }
  onFocusSubsystem() {
    if (this.techButton) {
      const focus = this.Root.querySelector(":focus");
      if (focus) {
        FocusManager.clearFocus(focus);
      } else {
        FocusManager.setFocus(this.techButton);
      }
    }
  }
  openCultureChooser() {
    ContextManager.push("screen-culture-tree-chooser", { singleton: true });
  }
  openTechChooser() {
    ContextManager.push("screen-tech-tree-chooser", { singleton: true });
  }
  onOpenPolicies() {
    ContextManager.push("screen-policies", { singleton: true, createMouseGuard: true });
  }
  openRankings() {
    ContextManager.push("screen-victory-progress", { singleton: true, createMouseGuard: true });
  }
  onOpenGreatWorks() {
    ContextManager.push("screen-great-works", { singleton: true, createMouseGuard: true });
  }
  onOpenResourceAllocation() {
    ContextManager.push("screen-resource-allocation", { singleton: true, createMouseGuard: true });
  }
  onOpenUnlocks() {
    const unlocksData = {
      category: PopupSequencer.getCategory(),
      screenId: "screen-unlocks",
      properties: { singleton: true, createMouseGuard: true }
    };
    PopupSequencer.addDisplayRequest(unlocksData);
  }
  onGoldenAgeChanged() {
    this.updatePoliciesStructure();
  }
  getReligionScreenName() {
    const curAge = Game.age;
    if (curAge == Database.makeHash("AGE_ANTIQUITY")) {
      const player = Players.get(GameContext.localPlayerID);
      if (!player) {
        console.error("panel-sub-system-dock: openReligionViewer() - no local player found!");
        return;
      }
      const playerCulture = player.Culture;
      if (!playerCulture) {
        console.error("panel-sub-system-dock: openReligionViewer() - no player culture found!");
        return;
      }
      const playerReligion = player.Religion;
      if (!playerReligion) {
        console.error("panel-sub-system-dock: openReligionViewer() - no player religion found!");
        return;
      }
      const numPantheonsToAdd = playerReligion.getNumPantheonsUnlocked();
      const mustAddPantheons = playerCulture.isNodeUnlocked("NODE_CIVIC_AQ_MAIN_MYSTICISM") && numPantheonsToAdd > 0;
      if (mustAddPantheons) {
        return "screen-pantheon-chooser";
      } else {
        return "panel-pantheon-complete";
      }
    } else if (curAge == Database.makeHash("AGE_EXPLORATION")) {
      const player = Players.get(GameContext.localPlayerID);
      if (!player) {
        console.error("panel-sub-system-dock: openReligionViewer() - No player object found!");
        return;
      }
      if (!player.Religion) {
        console.error("panel-sub-system-dock: openReligionViewer() - No player religion object found!");
        return;
      }
      if (player.Religion.canCreateReligion() && !player.Religion.hasCreatedReligion()) {
        return "panel-religion-picker";
      } else {
        return "panel-belief-picker";
      }
    }
    return;
  }
  openReligionViewer() {
    const screen = this.getReligionScreenName();
    if (screen) {
      if (Game.age == Database.makeHash("AGE_MODERN")) {
        console.error(
          "panel-sub-system-dock: openReligionViewer() - religion button pressed during an age that is neither Exploration nor Antiquity!"
        );
      }
      ContextManager.push(screen, { singleton: true });
    }
  }
  get ageNeverEnds() {
    return Game.AgeProgressManager.isExtendedGame || Game.AgeProgressManager.getMaxAgeProgressionPoints() <= 0;
  }
}
Controls.define("panel-sub-system-dock", {
  createInstance: PanelSubSystemDock,
  description: "Area for sub system button icons.",
  opens: [
    "screen-culture-tree-chooser",
    "screen-victory-progress",
    "screen-tech-tree-chooser",
    "screen-policies",
    "screen-great-works",
    "screen-resource-allocation",
    "screen-unlocks",
    "screen-pantheon-chooser",
    "panel-pantheon-complete",
    "panel-religion-picker",
    "panel-belief-picker"
  ],
  classNames: ["sub-system-dock", "allowCameraMovement"],
  styles: [styles],
  images: [
    "blp:sub_agetimer",
    "blp:hud_omt_infinity",
    "blp:sub_tech",
    "blp:sub_civics",
    "blp:sub_govt",
    "blp:sub_resource",
    "blp:sub_greatworks",
    "blp:sub_religion",
    "blp:sub_greatworks",
    "blp:hud_age_circle_bk",
    "blp:hud_tech_circle_bk",
    "blp:hud_civic_circle_bk",
    "blp:hud_sub_circle_bk"
  ]
});
//# sourceMappingURL=panel-sub-system-dock.js.map
