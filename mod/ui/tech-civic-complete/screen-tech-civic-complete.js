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
import { A as Audio } from 'fs://game/core/ui/audio-base/audio-support.chunk.js';
import ContextManager from 'fs://game/core/ui/context-manager/context-manager.js';
import FocusManager from 'fs://game/core/ui/input/focus-manager.js';
import { N as NavTray } from 'fs://game/core/ui/navigation-tray/model-navigation-tray.chunk.js';
import { P as Panel } from 'fs://game/core/ui/panel-support.chunk.js';
import { D as Databind } from 'fs://game/core/ui/utilities/utilities-core-databinding.chunk.js';
import { a as formatStringArrayAsNewLineText } from 'fs://game/core/ui/utilities/utilities-core-textprovider.chunk.js';
import { MustGetElement } from 'fs://game/core/ui/utilities/utilities-dom.chunk.js';
import { Icon } from 'fs://game/core/ui/utilities/utilities-image.chunk.js';
import { P as ProgressionTreeTypes, a as TechCivicPopupManager } from 'fs://game/base-standard/ui/tech-civic-complete/tech-civic-popup-manager.chunk.js';
import { c as TreeNodesSupport } from 'fs://game/base-standard/ui/tree-grid/tree-support.chunk.js';
import { g as getUnlockTargetName, a as getUnlockTargetDescriptions, b as getUnlockTargetIcon } from '../utilities/utilities-textprovider.chunk.js'; // we replaced this file!
import 'fs://game/core/ui/context-manager/display-queue-manager.js';
import 'fs://game/core/ui/dialog-box/manager-dialog-box.chunk.js';
import 'fs://game/core/ui/framework.chunk.js';
import 'fs://game/core/ui/input/cursor.js';
import 'fs://game/core/ui/views/view-manager.chunk.js';
import 'fs://game/core/ui/input/action-handler.js';
import 'fs://game/core/ui/input/input-support.chunk.js';
import 'fs://game/core/ui/utilities/utilities-update-gate.chunk.js';
import 'fs://game/core/ui/utilities/utilities-component-id.chunk.js';
import 'fs://game/core/ui/interface-modes/interface-modes.js';
import 'fs://game/base-standard/ui/tutorial/tutorial-item.js';
import 'fs://game/core/ui/utilities/utilities-layout.chunk.js';
import 'fs://game/base-standard/ui/utilities/utilities-tags.chunk.js';

// SeelingCat
let bP0kMP = false

for (const mod of Modding.getInstalledMods())
{
    if (mod.id == 'multiplayer-cinematics-and-pop-ups' && mod.enabled == true) {
      console.log("P0k Power Activate!")
      bP0kMP = true
      break
    }
}
// SeelingCat

const styles = "fs://game/base-standard/ui/tech-civic-complete/screen-tech-civic-complete.css";

var ScrollDirection = /* @__PURE__ */ ((ScrollDirection2) => {
  ScrollDirection2[ScrollDirection2["Left"] = 0] = "Left";
  ScrollDirection2[ScrollDirection2["Right"] = 1] = "Right";
  return ScrollDirection2;
})(ScrollDirection || {});
class ScreenTechCivicComplete extends Panel {
  //Used to position and animate unlocked items
  static UNLOCKED_ITEM_WIDTH = 13;
  static UNLOCKED_ITEM_PADDING = 1;
  static UNLOCKED_ITEM_LEFT_OFFSET = ScreenTechCivicComplete.UNLOCKED_ITEM_WIDTH + ScreenTechCivicComplete.UNLOCKED_ITEM_PADDING;
  static UNLOCKED_ITEMS_CONTAINER_WIDTH = 60;
  static UNLOCKED_ITEMS_EXTRA_OFFSET = 4;
  //Extra offset to allow the last item to be fully displayed + some deadspace to better communicate there is nothing else in the list
  static UNLOCKED_ITEMS_VISIBLE_NUMBER = Math.floor(
    ScreenTechCivicComplete.UNLOCKED_ITEMS_CONTAINER_WIDTH / (ScreenTechCivicComplete.UNLOCKED_ITEM_WIDTH + ScreenTechCivicComplete.UNLOCKED_ITEM_PADDING)
  );
  // How many items we can see before having to scroll. Use on Gamepad mode only.
  unlockedItems = [];
  // TODO: To use a fxs-scrollable-horizontal instead of the following arrows and a scrolling handled locally by the screen
  leftScrollArrow = null;
  rightScrollArrow = null;
  currentScrollOffset = 0;
  unlockedItemDefinitions = [];
  firstVisibleUnlockedItemIndex = 0;
  // Index of the first / left most visible unlocked item. Use on Gamepad mode only.
  unlockedItemFocusListener = this.onUnlockedItemFocus.bind(this);
  treeType = ProgressionTreeTypes.CULTURE;
  modalFrame = document.createElement("fxs-modal-frame");
  buttonSlot = document.createElement("fxs-vslot");
  unlockedItemsContainer = document.createElement("fxs-hslot");
  unlockItemsParentWrapper = document.createElement("fxs-scrollable");
  popupData = TechCivicPopupManager.currentTechCivicPopupData;
  node;
  nodeDefinition = this.popupData?.node;
  tooltipsFocused = false;
  engineInputListener = this.onEngineInput.bind(this);
  onInitialize() {
    super.onInitialize();
    if (!this.popupData) {
      console.error("screen-tech-civic-complete: TechCivicPopupData was null/undefined.");
      delayByFrame(() => {
        TechCivicPopupManager.closePopup();
      }, 3);
      return;
    }
    if (!this.popupData.node) {
      console.error("screen-tech-civic-complete: TechCivicPopupData.node was null/undefined.");
      delayByFrame(() => {
        TechCivicPopupManager.closePopup();
      }, 3);
      return;
    }
    const node = Game.ProgressionTrees.getNode(
      GameContext.localPlayerID,
      this.popupData.node.ProgressionTreeNodeType
    );
    if (!node) {
      console.error(
        "screen-tech-civic-complete: Unable to get a ProgressionTreeNode object for ProgressionTreeNodeType: ",
        this.popupData.node.ProgressionTreeNodeType
      );
      delayByFrame(() => {
        TechCivicPopupManager.closePopup();
      }, 3);
      return;
    } else {
      this.node = node;
    }
    this.treeType = this.popupData.treeType;
    this.updateItemsUnlockedByNode();
    this.render();
  }
  onAttach() {
    super.onAttach();
    const isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
    if (this.treeType == ProgressionTreeTypes.CULTURE) {
      UI.sendAudioEvent(Audio.getSoundTag("data-audio-showing-civic", "audio-tech-civic-complete"));
      if (TechCivicPopupManager.isFirstCivic) {
        TechCivicPopupManager.isFirstCivic = false;
      }
    } else {
      UI.sendAudioEvent(Audio.getSoundTag("data-audio-showing-tech", "audio-tech-civic-complete"));
      if (TechCivicPopupManager.isFirstTech) {
        TechCivicPopupManager.isFirstTech = false;
      }
    }
    const quote = GameInfo.TypeQuotes.lookup(this.nodeDefinition.ProgressionTreeNodeType);
    // SeelingCat
    if (quote && quote.QuoteAudio && this.node.depthUnlocked < 2) {
      UI.sendAudioEvent(quote.QuoteAudio);
    }
    // SeelingCat
    this.Root.classList.toggle("pt-8", isMobileViewExperience);
    this.Root.addEventListener("engine-input", this.engineInputListener);
  }
  onDetach() {
    Sound.play("Stop_Quote");
    if (this.treeType == ProgressionTreeTypes.CULTURE) {
      UI.sendAudioEvent(Audio.getSoundTag("data-audio-hiding-civic", "audio-tech-civic-complete"));
    } else {
      UI.sendAudioEvent(Audio.getSoundTag("data-audio-hiding-tech", "audio-tech-civic-complete"));
    }
    this.Root.removeEventListener("engine-input", this.engineInputListener);
    super.onDetach();
  }
  onEngineInput(inputEvent) {
    if (inputEvent.detail.status != InputActionStatuses.FINISH) {
      return;
    }
    if (inputEvent.isCancelInput() || inputEvent.detail.name == "sys-menu" || inputEvent.detail.name == "accept") {
      TechCivicPopupManager.closePopup();
      NavTray.clear();
      inputEvent.stopPropagation();
      inputEvent.preventDefault();
    } else if (inputEvent.detail.name == "shell-action-1" && this.treeType === ProgressionTreeTypes.CULTURE) {
      this.onChangePolicies();
      inputEvent.stopPropagation();
      inputEvent.preventDefault();
    } else if (inputEvent.detail.name == "shell-action-2") {
      this.toggleTooltips();
      inputEvent.stopPropagation();
      inputEvent.preventDefault();
    }
  }
  onReceiveFocus() {
    super.onReceiveFocus();
    this.setUpNavTray();
    if (!this.tooltipsFocused) {
      FocusManager.setFocus(this.Root);
    } else {
      FocusManager.setFocus(this.unlockedItemsContainer);
    }
  }
  onLoseFocus() {
    NavTray.clear();
  }
  toggleTooltips() {
    if (this.tooltipsFocused) {
      FocusManager.setFocus(this.Root);
      this.setUpNavTray();
    } else {
      FocusManager.setFocus(this.unlockedItemsContainer);
      NavTray.removeGenericOK();
    }
    this.tooltipsFocused = !this.tooltipsFocused;
  }
  setUpNavTray() {
    NavTray.clear();
    NavTray.addOrUpdateGenericBack();
    NavTray.addOrUpdateGenericOK();
    NavTray.addOrUpdateShellAction2("LOC_SHELL_ACTION_4_HELP");
    if (this.treeType === ProgressionTreeTypes.CULTURE) {
      NavTray.addOrUpdateShellAction1("LOC_TECH_CIVIC_CHANGE_POLICIES");
    }
  }
  onChangePolicies = () => {
    TechCivicPopupManager.closePopup();
    ContextManager.push("screen-policies", { singleton: true, createMouseGuard: true });
  };
  updateItemsUnlockedByNode() {
    this.unlockedItemDefinitions = [];
    const treeNodeUnlocks = TreeNodesSupport.getValidNodeUnlocks(this.node);
    const removableUnlocks = TreeNodesSupport.getRepeatedUniqueUnits(treeNodeUnlocks);
    for (const i of this.node.unlockIndices) {
      const unlockInfo = GameInfo.ProgressionTreeNodeUnlocks[i];
      if (unlockInfo?.Hidden || unlockInfo.UnlockDepth != this.node.depthUnlocked) {
        continue;
      }
      if (unlockInfo.TargetKind == "KIND_UNIT") {
        const player = Players.get(GameContext.localPlayerID);
        if (player?.Units?.isBuildPermanentlyDisabled(unlockInfo.TargetType)) {
          continue;
        }
        if (removableUnlocks.includes(unlockInfo.TargetType)) {
          continue;
        }
      }
      const unlockName = getUnlockTargetName(unlockInfo.TargetType, unlockInfo.TargetKind);
      const unlockDescriptions = getUnlockTargetDescriptions(unlockInfo.TargetType, unlockInfo.TargetKind);
      const unlockFullDesc = formatStringArrayAsNewLineText(unlockDescriptions);
      if (!unlockFullDesc && !unlockName) {
        continue;
      }
      this.unlockedItemDefinitions.push(unlockInfo);
    }
  }
  createUnlockedItem(unlockInfo, index, isOverflow) {
    const unlockedItem = document.createElement("fxs-activatable");
    unlockedItem.classList.add(
      "relative",
      "size-12",
      "bg-center",
      "bg-contain",
      "bg-no-repeat",
      "pointer-events-auto",
      "mx-1",
      "group"
    );
    unlockedItem.setAttribute("tabindex", index.toString());
    unlockedItem.addEventListener("focus", this.unlockedItemFocusListener);
    const unlockDescriptions = getUnlockTargetDescriptions(unlockInfo.TargetType, unlockInfo.TargetKind);
    const unlockName = getUnlockTargetName(unlockInfo.TargetType, unlockInfo.TargetKind);
    unlockDescriptions.unshift(unlockName);
    const unlockTooltip = formatStringArrayAsNewLineText(unlockDescriptions);
    unlockedItem.setAttribute("data-tooltip-content", unlockTooltip);
    if (isOverflow) {
    }
    const unlockIcon = getUnlockTargetIcon(unlockInfo.TargetType, unlockInfo.TargetKind);
    unlockedItem.style.backgroundImage = `url(${unlockIcon})`;
    const unlockGlow = document.createElement("div");
    unlockGlow.classList.value = "absolute -inset-0\\.5 opacity-0 bg-center bg-contain bg-no-repeat group-pressed\\:opacity-100 group-hover\\:opacity-100 group-focus\\:opacity-100 transition-opacity";
    unlockGlow.style.backgroundImage = `url(memento_circle-focus)`;
    unlockedItem.appendChild(unlockGlow);
    return unlockedItem;
  }
  scrollUnlockedItems(direction) {
    const totalIconsWidth = ScreenTechCivicComplete.UNLOCKED_ITEM_LEFT_OFFSET * this.unlockedItemDefinitions.length;
    let leftOffsetDelta = ScreenTechCivicComplete.UNLOCKED_ITEM_LEFT_OFFSET;
    if (direction == 0 /* Left */) {
      if (this.currentScrollOffset - ScreenTechCivicComplete.UNLOCKED_ITEM_LEFT_OFFSET < 0) {
        leftOffsetDelta = -parseFloat(this.unlockedItems[0].style.left);
      }
    } else {
      const currentRightBounds = this.currentScrollOffset + ScreenTechCivicComplete.UNLOCKED_ITEMS_CONTAINER_WIDTH + ScreenTechCivicComplete.UNLOCKED_ITEMS_EXTRA_OFFSET;
      if (currentRightBounds + ScreenTechCivicComplete.UNLOCKED_ITEM_LEFT_OFFSET > totalIconsWidth) {
        leftOffsetDelta = currentRightBounds + ScreenTechCivicComplete.UNLOCKED_ITEM_LEFT_OFFSET - totalIconsWidth;
      }
    }
    const step = direction == 0 /* Left */ ? 1 : -1;
    leftOffsetDelta *= step;
    this.currentScrollOffset += -leftOffsetDelta;
    this.firstVisibleUnlockedItemIndex += -step;
    if (this.firstVisibleUnlockedItemIndex < 0 || this.firstVisibleUnlockedItemIndex > this.unlockedItemDefinitions.length - ScreenTechCivicComplete.UNLOCKED_ITEMS_VISIBLE_NUMBER) {
      console.error("screen-tech-civic-complete: scrollUnlockedItems(): Incoherent first visible item index");
    }
    const leftDisabled = this.currentScrollOffset <= 0;
    this.leftScrollArrow?.setAttribute("disabled", leftDisabled.toString());
    const newRightBounds = this.currentScrollOffset + ScreenTechCivicComplete.UNLOCKED_ITEMS_CONTAINER_WIDTH + ScreenTechCivicComplete.UNLOCKED_ITEMS_EXTRA_OFFSET;
    const rightDisabled = newRightBounds >= totalIconsWidth;
    this.rightScrollArrow?.setAttribute("disabled", rightDisabled.toString());
  }
  onLeftScrollArrow = () => {
    this.scrollUnlockedItems(0 /* Left */);
  };
  onRightScrollArrow = () => {
    this.scrollUnlockedItems(1 /* Right */);
  };
  onUnlockedItemFocus(event) {
    const target = event.target;
    if (target == null) {
      console.error(
        "screen-tech-civic-complete: onUnlockedIconBGFocus(): Invalid event target. It should be an HTMLElement"
      );
      return;
    }
    const indexStr = target.getAttribute("tabindex");
    if (indexStr == null || indexStr === "-1") {
      console.error("screen-tech-civic-complete: onItemFocus(): Invalid tabindex attribute");
      return;
    }
    const index = parseInt(indexStr);
    if (index < this.firstVisibleUnlockedItemIndex) {
      this.scrollUnlockedItems(0 /* Left */);
    } else if (index >= this.firstVisibleUnlockedItemIndex + ScreenTechCivicComplete.UNLOCKED_ITEMS_VISIBLE_NUMBER) {
      this.scrollUnlockedItems(1 /* Right */);
    }
  }
  /**
   *
   * @returns
   * <fxs-vslot class="flex flex-col items-center pb-1 px-1">
   *    <div data-l10n-id="${unlocksTitle}" class="self-center text-sm text-accent-2 font-title tracking-100"></div>
   *    <fxs-hslot>
   *      <fxs-activatable class="img-arrow"></fxs-activatable>
   *      <div><!-- Unlock Items --></div>
   *      <fxs-activatable class="img-arrow -scale-y-100"></fxs-activatable>
   *    </fxs-hslot>
   * </fxs-vslot>
   */
  renderUnlockedItemsSection(unlocksTitle) {
    const unlockedItemsSlot = document.createElement("fxs-vslot");
    unlockedItemsSlot.classList.add("flex", "flex-col", "items-center", "mx-1", "mb-6");
    const unlockedItemsTitle = document.createElement("div");
    unlockedItemsTitle.classList.add(
      "self-center",
      "mb-4",
      "text-sm",
      "text-accent-2",
      "font-title",
      "tracking-100",
      "uppercase"
    );
    unlockedItemsTitle.textContent = Locale.compose(unlocksTitle, this.unlockedItemDefinitions.length);
    const unlockItemsContainerSlot = document.createElement("fxs-hslot");
    unlockItemsContainerSlot.classList.add(
      "max-w-full",
      "flex",
      "flex-auto",
      "items-center",
      "justify-center",
      "px-4"
    );
    const leftArrowButton = document.createElement("fxs-activatable");
    leftArrowButton.classList.add("hidden", "img-arrow");
    leftArrowButton.addEventListener("action-activate", this.onLeftScrollArrow);
    const rightArrowbutton = document.createElement("fxs-activatable");
    rightArrowbutton.classList.add("hidden", "img-arrow", "-scale-x-100");
    rightArrowbutton.addEventListener("action-activate", this.onRightScrollArrow);
    this.unlockedItemsContainer.classList.add(
      "flex",
      "flex-auto",
      "items-center",
      "justify-center",
      "overflow-x-scroll"
    );
    this.unlockedItemsContainer.setAttribute("tabindex", "-1");
    unlockItemsContainerSlot.appendChild(leftArrowButton);
    unlockItemsContainerSlot.appendChild(this.unlockedItemsContainer);
    unlockItemsContainerSlot.appendChild(rightArrowbutton);
    unlockedItemsSlot.appendChild(unlockedItemsTitle);
    unlockedItemsSlot.appendChild(unlockItemsContainerSlot);
    return unlockedItemsSlot;
  }
  render() {
    const isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
    const popupData = {
      [ProgressionTreeTypes.TECH]: {
        title: "LOC_TECH_CIVIC_TECH_UNLOCKED",
        unlocksTitle: "LOC_TECH_CIVIC_UNLOCKED_BY_TECH"
      },
      [ProgressionTreeTypes.CULTURE]: {
        title: "LOC_TECH_CIVIC_CIVIC_UNLOCKED",
        unlocksTitle: "LOC_TECH_CIVIC_UNLOCKED_BY_CIVIC"
      }
    };
    const { title, unlocksTitle } = popupData[this.treeType];
    const iconUrl = `url(${Icon.getCultureIconFromProgressionTreeNodeDefinition(this.nodeDefinition)})`;
    this.modalFrame.dataset.modalStyle = "special";
    // SeelingCat begin
    let name = this.nodeDefinition.Name
    let depth = this.node.depthUnlocked;
    if (depth > 1) {
        if (Locale.keyExists(name + "_" + depth)) {
            name += "_" + depth
        }
    }
    this.modalFrame.innerHTML = `
      <fxs-header class="text-secondary font-title uppercase text-lg tracking-150" title="${title}" filigree-style="small"></fxs-header>
      <div class="relative flex items-center justify-center">
        <div class="absolute inset-0 flex items-center justify-center">
          <img src="fs://game/popup_icon_glow" />
        </div>
        <div class="absolute inset-x-0 flex justify-between">
          <div class="img-popup-icon-decor"></div>
          <div class="img-popup-icon-decor -scale-x-100"></div>
        </div>
        <div class="relative size-38">
          <div class="absolute inset-0 size-38 img-popup-icon-wood-bk"></div>
          <div class="absolute inset-8 bg-center bg-no-repeat bg-contain" style="background-image: ${iconUrl}"></div>
        </div>
      </div>
      <div class="tech-civic-name-container flex items-center justify-center mt-5 mb-3\\.5 img-popup-header-bk">
        <div data-l10n-id="${name}" class="text-accent-2 text-base text-center uppercase font-title tracking-100 px-1 pt-4 pb-3"></div>
      </div>
    `;
    // end SeelingCat
    if (isMobileViewExperience) {
      const closeButton = document.createElement("fxs-close-button");
      closeButton.addEventListener("action-activate", TechCivicPopupManager.closePopup);
      closeButton.classList.add("top-2", "right-0\\.5");
      this.modalFrame.appendChild(closeButton);
      const header = MustGetElement("fxs-header", this.modalFrame);
      header.classList.add("mt-9");
      const nameContainer = MustGetElement(".tech-civic-name-container", this.modalFrame);
      nameContainer.classList.remove("mt-5", "mb-3\\.5");
      nameContainer.classList.add("mt-1", "mb-2");
      this.Root.classList.remove("pt-8");
      this.Root.classList.add("pt-10");
    } else {
      const okButton = document.createElement("fxs-button");
      okButton.setAttribute("caption", "LOC_GENERIC_OK");
      okButton.addEventListener("action-activate", TechCivicPopupManager.closePopup);
      Databind.if(okButton, `!{{g_NavTray.isTrayRequired}}`);
      this.buttonSlot.appendChild(okButton);
    }
    this.buttonSlot.classList.add("flex", "mx-4");
    this.buttonSlot.classList.toggle("mt-6", !isMobileViewExperience);
    this.buttonSlot.classList.toggle("mb-4", !isMobileViewExperience);
    this.buttonSlot.classList.toggle("my-3", isMobileViewExperience);
    if (this.treeType === ProgressionTreeTypes.CULTURE) {
      const changePoliciesButton = document.createElement("fxs-button");
      Databind.if(changePoliciesButton, `!{{g_NavTray.isTrayRequired}}`);
      changePoliciesButton.classList.add("mb-2");
      changePoliciesButton.setAttribute("caption", "LOC_TECH_CIVIC_CHANGE_POLICIES");
      changePoliciesButton.addEventListener("action-activate", this.onChangePolicies);
      changePoliciesButton.setAttribute("data-audio-group-ref", "audio-tech-civic-complete");
      this.buttonSlot.insertAdjacentElement("afterbegin", changePoliciesButton);
    }
    const numUnlockedItems = this.unlockedItemDefinitions.length;
    if (numUnlockedItems > 0) {
      const unlockedItemsSection = this.renderUnlockedItemsSection(unlocksTitle);
      let isOverflow = false;
      const totalIconsWidth = ScreenTechCivicComplete.UNLOCKED_ITEM_LEFT_OFFSET * this.unlockedItemDefinitions.length;
      if (totalIconsWidth > ScreenTechCivicComplete.UNLOCKED_ITEMS_CONTAINER_WIDTH) {
        this.unlockedItemsContainer.classList.add("overflow");
        isOverflow = true;
      }
      for (let i = 0; i < numUnlockedItems; i++) {
        const unlockedItem = this.createUnlockedItem(this.unlockedItemDefinitions[i], i, isOverflow);
        this.unlockedItemsContainer.appendChild(unlockedItem);
      }
      this.unlockItemsParentWrapper.appendChild(unlockedItemsSection);
    }
    const quote = GameInfo.TypeQuotes.lookup(this.nodeDefinition.ProgressionTreeNodeType);
    if (quote && Locale.keyExists(quote.Quote)) {
      //SeelingCat
      let quoteOG = quote.Quote
      let authorOG = quote.QuoteAuthor
      if (Locale.keyExists(quote.Quote + "_" + depth)) {
        quoteOG += "_" + depth
        authorOG += "_" + depth
      }
      const quoteContainer = document.createElement("fxs-vslot");
      let quoteHTML = `<fxs-inner-frame class="min-h-32 mx-4 p-3">
          <div class="absolute -top-1\\.5 img-popup-middle-decor"></div>
          <span class="text-accent-3 text-base" data-l10n-id="${quoteOG}"></span>`;
      if (quote.QuoteAuthor && Locale.keyExists(quote.QuoteAuthor)) {
        quoteHTML += `<span class="text-accent-3 text-base" data-l10n-id="${Locale.compose(authorOG)}"></span>`;
      }
      // SeelingCat 
      quoteHTML += `</fxs-inner-frame>`;
      quoteContainer.innerHTML = quoteHTML;
      this.unlockItemsParentWrapper.appendChild(quoteContainer);
    }
    this.unlockItemsParentWrapper.setAttribute("attached-scrollbar", "true");
    this.unlockItemsParentWrapper.classList.add("shrink");
    this.unlockItemsParentWrapper.appendChild(this.buttonSlot);
    this.modalFrame.appendChild(this.unlockItemsParentWrapper);
    this.Root.appendChild(this.modalFrame);
  }
}
Controls.define("screen-tech-civic-complete", {
  createInstance: ScreenTechCivicComplete,
  description: "Screen for displaying info for recently completed techs/civics.",
  styles: [styles],
  tabIndex: -1
});
//# sourceMappingURL=screen-tech-civic-complete.js.map
