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
import ActionHandler, { ActiveDeviceTypeChangedEventName } from 'fs://game/core/ui/input/action-handler.js';
import { F as Focus } from 'fs://game/core/ui/input/focus-support.chunk.js';
import { N as NavTray } from 'fs://game/core/ui/navigation-tray/model-navigation-tray.chunk.js';
import { P as Panel, A as AnchorType } from 'fs://game/core/ui/panel-support.chunk.js';
import { D as Databind } from 'fs://game/core/ui/utilities/utilities-core-databinding.chunk.js';
import { MustGetElement } from 'fs://game/core/ui/utilities/utilities-dom.chunk.js';
import { T as TechTree } from 'fs://game/base-standard/ui/tech-tree/model-tech-tree.chunk.js';
import { TreeCardHoveredEventName, TreeCardDehoveredEventName, TreeCardActivatedEventName } from '../tree-grid/tree-card.js'; // we replaced this file!
import { t as template, Q as addEventListener, i as insert, X as classList, e as className, k as defineLegacyComponent } from 'fs://game/core/ui-next/components/tooltip-model.chunk.js';
import { e as createMemo, g as getOwner, d as createComponent, f as createRenderEffect, S as Show, F as For, c as createSignal, o as onMount, b as onCleanup, a as createEffect } from 'fs://game/core/ui-next/services/model-registry.chunk.js';
import { L as L10n } from 'fs://game/core/ui-next/components/slot.chunk.js';
import { R as RingMeter } from 'fs://game/core/ui-next/components/ring-meter.chunk.js';
import { c as TooltipHorizontalPosition, b as TooltipVerticalPosition } from 'fs://game/core/ui-next/components/tooltip.chunk.js';
import { d as TreeClassSelector, S as ScaleTreeCardEventName, T as TreeSupport, a as TreeGridDirection } from 'fs://game/base-standard/ui/tree-grid/tree-support.chunk.js';
import { c as convertLegacyDepthInfo, T as TechCivicTooltip } from 'fs://game/base-standard/ui-next/tooltips/tech-civic-tooltip.chunk.js';
import { s as styles } from 'fs://game/base-standard/ui/tree-grid/tree-components.chunk.js';
import 'fs://game/core/ui/framework.chunk.js';
import 'fs://game/core/ui/input/cursor.js';
import 'fs://game/core/ui/input/focus-manager.js';
import 'fs://game/core/ui/views/view-manager.chunk.js';
import 'fs://game/core/ui/input/input-support.chunk.js';
import 'fs://game/core/ui/utilities/utilities-update-gate.chunk.js';
import 'fs://game/core/ui/spatial/spatial-manager.js';
import 'fs://game/core/ui/context-manager/context-manager.js';
import 'fs://game/core/ui/context-manager/display-queue-manager.js';
import 'fs://game/core/ui/dialog-box/manager-dialog-box.chunk.js';
import 'fs://game/core/ui/utilities/utilities-image.chunk.js';
import 'fs://game/core/ui/utilities/utilities-component-id.chunk.js';
import '../tree-grid/tree-grid.chunk.js'; // we replaced this file!
import 'fs://game/core/ui/graph-layout/utils.chunk.js';
import 'fs://game/core/ui/graph-layout/layout.chunk.js';
import 'fs://game/core/ui/utilities/utilities-core-textprovider.chunk.js';
import '../utilities/utilities-textprovider.chunk.js'; // we replaced this file!
import 'fs://game/base-standard/ui/utilities/utilities-tags.chunk.js';
import 'fs://game/core/ui/utilities/utilities-layout.chunk.js';
import 'fs://game/core/ui-next/components/activatable.chunk.js';
import 'fs://game/core/ui-next/components/nav-help.chunk.js';
import 'fs://game/core/ui-next/utilities/game-core-utilities.chunk.js';
import 'fs://game/base-standard/ui-next/components/pills.chunk.js';

var _tmpl$ = /* @__PURE__ */ template(`<div class="tree-node-icon bg-cover bg-center self-center"></div>`), _tmpl$2 = /* @__PURE__ */ template(`<div class="tree-card-queue-order font-body text-xs text-accent-2 mr-1 hidden"></div>`), _tmpl$3 = /* @__PURE__ */ template(`<div class="check-icon flex absolute size-6 bg-no-repeat bg-center bg-contain right-4 top-3 justify-center items-center"><div class="size-4 bg-center bg-contain bg-no-repeat"></div></div>`), _tmpl$4 = /* @__PURE__ */ template(`<fxs-activatable class="pointer-events-auto relative tree-card-hitbox"tabindex=-1 name=TreeCard-Hitbox><div></div><div><div class="tree-card-progress flex flex-col items-center justify-center pointer-events-none relative"><div class="flex relative justify-center items-center"></div></div><div class="tree-card-name-unlocks flex flex-col flex-initial w-full justify-between"><div class="tree-card-name-container relative flex flex-row justify-between items-center"><div class="tree-card-name font-title text-base flex-initial tracking-150 truncate font-fit-shrink"></div><div class="turn-text font-body text-xs shrink-0 ml-2 mr-1"></div></div><div class="tree-card-unlocks flex items-center mt-1 pointer-events-none relative"></div></div></div></fxs-activatable>`, true, false, false), _tmpl$5 = /* @__PURE__ */ template(`<div class="unlock-item bg-no-repeat bg-contain bg-center mr-1"></div>`), _tmpl$6 = /* @__PURE__ */ template(`<fxs-vslot class="main-container flex flex-col flex-auto pointer-events-none items-center"disablefocus></fxs-vslot>`, true, false, false);
const MASTERY_ICON_PATH = "blp:techtree_icon-II.png";
function parseNumber(v, fallback = 0) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function parseJSON(v, fallback) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
const NodeCard = (props) => {
  const iconURL = createMemo(() => props.isMastery ? MASTERY_ICON_PATH : props.depth?.iconURL ?? "");
  const isLocked = createMemo(() => props.depth?.isLocked ?? false);
  const isCompleted = createMemo(() => props.depth?.isCompleted ?? false);
  const isCurrent = createMemo(() => props.depth?.isCurrent ?? false);
  const getDisplayedProgress = (depth) => {
    if (!depth) return 0;
    if (depth.isCompleted) return 100;
    if (depth.isLocked) return 0;
    return props.progress;
  };
  const value = createMemo(() => getDisplayedProgress(props.depth));
  function dispatch(name, detail) {
    props.el.dispatchEvent(new CustomEvent(name, {
      bubbles: false,
      cancelable: true,
      detail
    }));
  }
  const onHover = () => dispatch(TreeCardHoveredEventName, {
    type: props.type,
    level: String(props.level)
  });
  const onDehover = () => dispatch(TreeCardDehoveredEventName, {
    type: props.type,
    level: String(props.level)
  });
  const onActivate = () => {
    dispatch(TreeCardActivatedEventName, {
      type: props.type,
      level: String(props.level)
    });
  };
  const showTurns = createMemo(() => !(isLocked() || isCompleted()));
  const treeTypeClass = createMemo(() => props.treeType === "culture" ? "tree-type-culture" : "tree-type-tech");
  const convertedUnlocksByDepth = createMemo(() => convertLegacyDepthInfo(props.unlocksByDepth));
  const displayName = createMemo(() => {
    let name = props.name;
    if (props.level >= 1) {
      //SeelingCat
      let depthNumeral = props.level + 1;
      if (Locale.keyExists(name + "_" + depthNumeral)) {
        name = Locale.compose(name + "_" + depthNumeral)
        return Locale.compose(name);
      }
      else {
        name = Locale.compose(name)
        depthNumeral = Locale.toRomanNumeral(props.level + 1)
        name += " " + depthNumeral
        return Locale.compose(name);
      }
    }
    return Locale.compose(name);
    //SeelingCat
  });
  const renderContent = () => (() => {
    var _el$ = _tmpl$4(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$7 = _el$4.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$8.firstChild, _el$11 = _el$9.nextSibling, _el$12 = _el$8.nextSibling;
    addEventListener(_el$, "action-activate", onActivate);
    _el$.addEventListener("focus", onHover);
    _el$.addEventListener("mouseleave", onDehover);
    _el$.addEventListener("mouseenter", onHover);
    _el$._$owner = getOwner();
    insert(_el$5, createComponent(RingMeter, {
      "class": "ring-size card-ring flex justify-center bg-contain bg-center flex-auto items-center absolute",
      max: 100,
      min: 0,
      get value() {
        return value();
      },
      get children() {
        var _el$6 = _tmpl$();
        createRenderEffect((_$p) => (_$p = `url(${iconURL()})`) != null ? _el$6.style.setProperty("background-image", _$p) : _el$6.style.removeProperty("background-image"));
        return _el$6;
      }
    }));
    //SeelingCat
    insert(_el$9, createComponent(L10n.Compose, {
      get text() {
        let name = props.name;
        if (props.level >= 1) {
          //SeelingCat
          let depthNumeral = props.level + 1;
          if (Locale.keyExists(name + "_" + depthNumeral)) {
            name = Locale.compose(name + "_" + depthNumeral)
            return Locale.compose(name);
          }
          else {
            name = Locale.compose(name)
            depthNumeral = Locale.toRomanNumeral(props.level + 1)
            name += " " + depthNumeral
            return Locale.compose(name);
          }
        }
        return Locale.compose(name);
      }
    }));
    //SeelingCat
    insert(_el$8, createComponent(Show, {
      get when() {
        return props.level === 0;
      },
      get children() {
        var _el$10 = _tmpl$2();
        insert(_el$10, createComponent(L10n.Compose, {
          get text() {
            return props.queueOrder;
          }
        }));
        return _el$10;
      }
    }), _el$11);
    insert(_el$11, createComponent(L10n.Compose, {
      text: "LOC_NARRATIVE_TURN_TIMER",
      get args() {
        return [props.turns];
      }
    }));
    insert(_el$12, createComponent(For, {
      get each() {
        return props.depth?.unlocks ?? [];
      },
      children: (unlock) => {
        const icon = unlock.icon ? unlock.icon : UI.getIconURL("MOD_GENERIC_BONUS");
        return (() => {
          var _el$15 = _tmpl$5();
          `url(${icon})` != null ? _el$15.style.setProperty("background-image", `url(${icon})`) : _el$15.style.removeProperty("background-image");
          return _el$15;
        })();
      }
    }));
    insert(_el$3, createComponent(Show, {
      get when() {
        return isCompleted();
      },
      get children() {
        var _el$13 = _tmpl$3(), _el$14 = _el$13.firstChild;
        _el$13.style.setProperty("background-image", 'url("blp:techtree-icon-empty")');
        _el$14.style.setProperty("background-image", 'url("blp:techtree_icon-checkmark")');
        return _el$13;
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = {
        [treeTypeClass()]: true,
        "current-research": isCurrent(),
        completed: isCompleted(),
        hidden: props.dummy,
        relative: !!props.isMastery,
        "-top-3": !!props.isMastery,
        "tree-card--mastery": !!props.isMastery,
        "parent-node": !props.isMastery
      }, _v$2 = `tree-card-type-${props.type}`, _v$3 = props.audio, _v$4 = isLocked(), _v$5 = String(props.level), _v$6 = props.type, _v$7 = `absolute bg-center bg-no-repeat pointer-events-none ${props.isMastery ? "tree-card__child-bg--base tree-card-child-background" : "tree-card__bg--base tree-card-background pt-px"}`, _v$8 = `card-background bg-center bg-no-repeat relative flex flex-row pointer-events-none ${props.isMastery ? "tree-card-child-bg" : "tree-card-bg pt-px"}`, _v$9 = !!isCompleted(), _v$10 = !showTurns();
      _p$.e = classList(_el$, _v$, _p$.e);
      _v$2 !== _p$.t && (_el$.id = _p$.t = _v$2);
      _v$3 !== _p$.a && (_el$.audio = _p$.a = _v$3);
      _v$4 !== _p$.o && (_el$.disablefocus = _p$.o = _v$4);
      _v$5 !== _p$.i && (_el$.dataLevel = _p$.i = _v$5);
      _v$6 !== _p$.n && (_el$.dataType = _p$.n = _v$6);
      _v$7 !== _p$.s && className(_el$2, _p$.s = _v$7);
      _v$8 !== _p$.h && className(_el$3, _p$.h = _v$8);
      _v$9 !== _p$.r && _el$9.classList.toggle("pr-6", _p$.r = _v$9);
      _v$10 !== _p$.d && _el$11.classList.toggle("hidden", _p$.d = _v$10);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0,
      s: void 0,
      h: void 0,
      r: void 0,
      d: void 0
    });
    return _el$;
  })();
  return createComponent(Show, {
    get when() {
      return !props.disableTooltip;
    },
    get fallback() {
      return renderContent();
    },
    get children() {
      return createComponent(TechCivicTooltip, {
        get node() {
          return {
            name: displayName(),
            unlocksByDepth: convertedUnlocksByDepth(),
            cost: props.cost,
            currentDepthIndex: props.level
          };
        },
        get isCulture() {
          return props.treeType === "culture";
        },
        get initialVPosition() {
          return TooltipVerticalPosition.CENTER;
        },
        get initialHPosition() {
          return TooltipHorizontalPosition.RIGHT;
        },
        allowFlip: true,
        offset: 10,
        get children() {
          return renderContent();
        }
      });
    }
  });
};
const TreeCard = (props) => {
  const type = createMemo(() => props.attrs["type"] ?? "");
  const name = createMemo(() => props.attrs["name"] ?? "");
  const queueOrder = createMemo(() => props.attrs["queue-order"] ?? "");
  const progress = createMemo(() => parseNumber(props.attrs["progress"], 0));
  const turns = createMemo(() => parseNumber(props.attrs["turns"], 0));
  const cost = createMemo(() => parseNumber(props.attrs["cost"], -1));
  const unlocksByDepth = createMemo(() => parseJSON(props.attrs["unlocks-by-depth"], []));
  const dummy = createMemo(() => (props.attrs["dummy"] ?? "false") === "true");
  const disableTooltip = createMemo(() => (props.attrs["disable-tooltip"] ?? "false") === "true");
  const treeType = createMemo(() => props.el.getAttribute("tree-type") ?? "");
  const audioGroup = createMemo(() => props.el.getAttribute("data-audio-group-ref") ?? void 0);
  const audioActivate = createMemo(() => props.el.getAttribute("data-audio-activate-ref") ?? void 0);
  const audioFocus = createMemo(() => props.el.getAttribute("data-audio-focus") ?? void 0);
  const [scale, setScale] = createSignal(1);
  const onCardScale = (ev) => {
    setScale(ev.detail?.scale ?? 1);
  };
  onMount(() => {
    props.el.classList.add("min-h-10", "w-96", TreeClassSelector.CARD);
    window.addEventListener(ScaleTreeCardEventName, onCardScale);
  });
  onCleanup(() => {
    window.removeEventListener(ScaleTreeCardEventName, onCardScale);
  });
  createEffect(() => {
    props.el.style.fontSize = `${scale()}rem`;
    props.el.classList.toggle("dummy", dummy());
  });
  const mainDepth = createMemo(() => unlocksByDepth()[0]);
  const tiers = createMemo(() => unlocksByDepth().slice(1));
  return (() => {
    var _el$16 = _tmpl$6();
    _el$16._$owner = getOwner();
    insert(_el$16, createComponent(NodeCard, {
      get depth() {
        return mainDepth();
      },
      level: 0,
      get el() {
        return props.el;
      },
      get treeType() {
        return treeType();
      },
      get dummy() {
        return dummy();
      },
      get audio() {
        return {
          group: audioGroup(),
          onActivate: audioActivate(),
          onFocus: audioFocus()
        };
      },
      get type() {
        return type();
      },
      get name() {
        return name();
      },
      get queueOrder() {
        return queueOrder();
      },
      get turns() {
        return turns();
      },
      get cost() {
        return cost();
      },
      get unlocksByDepth() {
        return unlocksByDepth();
      },
      get progress() {
        return progress();
      },
      get disableTooltip() {
        return disableTooltip();
      }
    }), null);
    insert(_el$16, createComponent(For, {
      get each() {
        return tiers();
      },
      children: (depth, i) => createComponent(NodeCard, {
        depth,
        get level() {
          return i() + 1;
        },
        isMastery: true,
        get el() {
          return props.el;
        },
        get treeType() {
          return treeType();
        },
        get dummy() {
          return dummy();
        },
        get audio() {
          return {
            group: audioGroup(),
            onActivate: audioActivate(),
            onFocus: audioFocus()
          };
        },
        get type() {
          return type();
        },
        get name() {
          return name();
        },
        get queueOrder() {
          return queueOrder();
        },
        get turns() {
          return turns();
        },
        get cost() {
          return cost();
        },
        get unlocksByDepth() {
          return unlocksByDepth();
        },
        get progress() {
          return progress();
        },
        get disableTooltip() {
          return disableTooltip();
        }
      })
    }), null);
    createRenderEffect((_$p) => (_$p = `${scale()}rem`) != null ? _el$16.style.setProperty("font-size", _$p) : _el$16.style.removeProperty("font-size"));
    return _el$16;
  })();
};
defineLegacyComponent("tree-card-v2", {
  classNames: ["tree-card"],
  tabIndex: -1,
  attrs: {
    dummy: "false",
    type: "",
    name: "",
    progress: "0",
    turns: "0",
    cost: "",
    "tooltip-type": "",
    "unlocks-by-depth": "[]",
    "queue-order": "",
    "disable-tooltip": "false"
  }
}, (attrs, el) => createComponent(TreeCard, {
  attrs,
  el
}));

const content = "<fxs-subsystem-frame\r\n\tno-scroll=\"true\"\r\n\tclass=\"items-center justify-center flex-auto\"\r\n\tdata-audio-showing=\"data-audio-window-overlay-open\"\r\n\tdata-audio-shown=\"tech-tree-chooser-panel-shown\"\r\n\tdata-audio-hidden=\"tech-tree-chooser-panel-hidden\"\r\n\tdata-audio-close-ref=\"data-audio-tech-tree-progression-close\"\r\n>\r\n\t<div class=\"flex flex-auto flex-col relative\">\r\n\t\t<fxs-header\r\n\t\t\tdata-slot=\"header\"\r\n\t\t\tclass=\"uppercase text-center tracking-100 mb-2 font-title-xl text-secondary\"\r\n\t\t\ttitle=\"LOC_UI_TECH_TREE_TITLE\"\r\n\t\t\tfiligree-style=\"h3\"\r\n\t\t>\r\n\t\t</fxs-header>\r\n\t\t<div\r\n\t\t\tid=\"tech-tree-content-container\"\r\n\t\t\tclass=\"flex flex-col flex-auto pb-5\"\r\n\t\t></div>\r\n\t</div>\r\n</fxs-subsystem-frame>\r\n";

class ScreenTechTree extends Panel {
  isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
  viewTechProgressionTreeListener = this.onViewProgressionTree.bind(this);
  engineInputListener = this.onEngineInput.bind(this);
  closeListener = this.close.bind(this);
  activeDeviceTypeListener = this.onActiveDeviceTypeChanged.bind(this);
  onCardActivateListener = this.onCardActivate.bind(this);
  onCardHoverListener = this.onCardHover.bind(this);
  onCardDehoverListener = this.onCardDehover.bind(this);
  startResearchButtonActivateListener = this.onStartResearchButtonActivate.bind(this);
  selectedNode;
  selectedLevel = 0;
  previousSelectedNode;
  frame;
  cardDetailContainer;
  contentContainer;
  treeDetail;
  startResearchButton;
  cardScaling = null;
  constructor(root) {
    super(root);
    this.animateInType = this.animateOutType = AnchorType.RelativeToLeft;
    this.enableOpenSound = true;
    this.enableCloseSound = true;
  }
  onAttach() {
    this.Root.setAttribute("data-audio-group-ref", "audio-screen-tech-tree");
    super.onAttach();
    window.addEventListener("view-tech-progression-tree", this.viewTechProgressionTreeListener);
    window.addEventListener(ActiveDeviceTypeChangedEventName, this.activeDeviceTypeListener);
    this.frame = MustGetElement("fxs-subsystem-frame", this.Root);
    if (this.isMobileViewExperience) {
      this.frame.setAttribute("box-style", "fullscreen");
      this.frame.setAttribute("outside-safezone-mode", "full");
      waitForLayout(() => this.frame.classList.remove("pb-10"));
    }
    this.contentContainer = MustGetElement("#tech-tree-content-container", this.Root);
    const player = Players.get(GameContext.localPlayerID);
    if (player) {
      const availableTechTree = player.Techs?.getTreeType();
      if (availableTechTree == void 0) {
        console.error("screen-tech-tree: onAttach(): Error getting progression trees");
      }
    }
    const closebutton = document.querySelector(".tech-tree-hex-grid-close");
    if (closebutton) {
      closebutton.addEventListener("action-activate", this.closeListener);
    }
    this.Root.addEventListener("engine-input", this.engineInputListener);
    this.frame.addEventListener("subsystem-frame-close", this.closeListener);
    engine.on("TechTreeChanged", this.onTechUpdated, this);
    engine.on("TechTargetChanged", this.onTechTargetUpdated, this);
    TechTree.updateGate.call("onAttach");
  }
  onReceiveFocus() {
    super.onReceiveFocus();
    this.realizeFocus();
  }
  realizeFocus() {
    const panelCategoryContainer = this.Root.querySelector("#tech-category-container");
    if (!panelCategoryContainer) {
      console.warn("screen-tech-tree: onReceiveFocus(): No tech category container found, focus is not posible");
      return;
    }
    const selectedElement = this.Root.querySelector(
      `tree-card-v2[type="${this.selectedNode}"]`
    );
    if (selectedElement) {
      Focus.setContextAwareFocus(selectedElement, this.Root);
    } else {
      Focus.setContextAwareFocus(panelCategoryContainer, this.Root);
    }
  }
  onTechUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    TechTree.updateGate.call("onTechUpdated");
  }
  onTechTargetUpdated(data) {
    if (data.player && data.player != GameContext.localPlayerID) {
      return;
    }
    TechTree.updateGate.call("onTechTargetUpdated");
  }
  onDetach() {
    window.removeEventListener("view-tech-progression-tree", this.viewTechProgressionTreeListener);
    window.removeEventListener(ActiveDeviceTypeChangedEventName, this.activeDeviceTypeListener);
    this.Root.removeEventListener("engine-input", this.engineInputListener);
    engine.off("TechTreeChanged", this.onTechUpdated, this);
    engine.off("TechTargetChanged", this.onTechTargetUpdated, this);
    if (this.cardScaling) {
      this.cardScaling.removeListeners();
    }
    super.onDetach();
  }
  onEngineInput(inputEvent) {
    if (inputEvent.detail.status != InputActionStatuses.FINISH) {
      return;
    }
    if (inputEvent.isCancelInput() || inputEvent.detail.name == "sys-menu") {
      this.close();
      inputEvent.stopPropagation();
      inputEvent.preventDefault();
    }
  }
  cleanPreviousSelectedNode() {
    if (this.previousSelectedNode != void 0) {
      const selectedElement = this.Root.querySelector(
        `tree-card-v2[type="${this.previousSelectedNode}"]`
      );
      if (selectedElement) {
        selectedElement.classList.remove("selected");
      } else {
        console.warn(
          "screen-tech-tree: cleanPreviousSelectedNode(): Previous selected rectangular card not found"
        );
      }
    }
  }
  onViewProgressionTree(event) {
    this.refreshProgressionTree(event.detail.treeCSV, event.detail.targetNode, event.detail.iconCallback);
  }
  refreshProgressionTree(treesCSV, targetNode, iconCallback) {
    if (iconCallback) {
      TechTree.iconCallback = iconCallback;
    }
    TechTree.sourceProgressionTrees = treesCSV;
    while (this.contentContainer.hasChildNodes()) {
      this.contentContainer.removeChild(this.contentContainer.lastChild);
    }
    const panelCategoryContainer = document.createElement("fxs-slot");
    panelCategoryContainer.id = "tech-category-container";
    panelCategoryContainer.classList.add("flex-auto", "items-center", "w-full", "flex", "relative");
    this.createPanelContent(panelCategoryContainer);
    this.contentContainer.appendChild(panelCategoryContainer);
    if (targetNode) {
      this.refreshDetailsPanel(targetNode);
    }
    waitForLayout(() => this.realizeFocus());
  }
  createPanelContent(container) {
    const tree = `g_TechTree.tree`;
    const { scrollable, cardScaling } = TreeSupport.getGridElement(
      tree,
      TreeGridDirection.HORIZONTAL,
      this.createCard.bind(this)
    );
    this.cardScaling = cardScaling;
    if (TreeSupport.isSmallScreen()) {
      scrollable.setAttribute("handle-gamepad-pan", "false");
    }
    this.cardDetailContainer = document.createElement("div");
    this.cardDetailContainer.classList.add(
      `card-detail-container`,
      "p-4",
      "pointer-events-none",
      "items-end",
      "w-96",
      "flex-col",
      "items-center",
      "max-h-full"
    );
    this.cardDetailContainer.classList.toggle("w-128", this.isMobileViewExperience);
    this.cardDetailContainer.classList.toggle("w-96", !this.isMobileViewExperience);
    container.appendChild(scrollable);
    container.appendChild(this.cardDetailContainer);
  }
  createCard(container) {
    const cardElement = document.createElement("tree-card-v2");
    Databind.if(cardElement, "card.hasData");
    Databind.attribute(cardElement, "dummy", "card.isDummy");
    Databind.attribute(cardElement, "type", "card.nodeType");
    Databind.attribute(cardElement, "name", "card.name");
    Databind.attribute(cardElement, "progress", "card.progressPercentage");
    Databind.attribute(cardElement, "turns", "card.turns");
    Databind.attribute(cardElement, "queue-order", "card.queueOrder");
    Databind.attribute(cardElement, "cost", "card.cost");
    Databind.attribute(cardElement, "unlocks-by-depth", "card.unlocksByDepthString");
    cardElement.setAttribute("tooltip-type", "tech-tree");
    if (TreeSupport.isSmallScreen()) {
      cardElement.setAttribute("disable-tooltip", "true");
    }
    cardElement.setAttribute("tree-type", "tech");
    cardElement.setAttribute("data-audio-group-ref", "audio-screen-tech-tree-chooser");
    cardElement.setAttribute("data-audio-activate-ref", "none");
    cardElement.setAttribute("data-audio-focus", "tech-tree-full-focus");
    Databind.classToggle(cardElement, "locked", "card.isLocked");
    Databind.classToggle(cardElement, "queued", "card.isQueued");
    cardElement.addEventListener(TreeCardHoveredEventName, this.onCardHoverListener);
    cardElement.addEventListener(TreeCardDehoveredEventName, this.onCardDehoverListener);
    cardElement.addEventListener(TreeCardActivatedEventName, this.onCardActivateListener);
    container.appendChild(cardElement);
  }
  refreshDetailsPanel(nodeId, level = "0") {
    this.previousSelectedNode = this.selectedNode;
    this.selectedNode = nodeId;
    this.selectedLevel = +level;
    this.cleanPreviousSelectedNode();
    this.updateTreeDetail(nodeId, level);
    const selectedElement = this.Root.querySelector(
      `tree-card-v2[type="${this.selectedNode}"]`
    );
    selectedElement?.classList.add("selected");
    this.refreshNavTray();
  }
  updateTreeDetail(nodeId, level) {
    if (!this.treeDetail) {
      if (!this.cardDetailContainer) {
        console.error(
          "screen-tech-tree: refreshDetailsPanel(): detailCardsContainer '.card-detail-container' couldn't be found"
        );
        return;
      }
      this.treeDetail = document.createElement("tree-detail");
      this.treeDetail.classList.add("max-w-full", "w-full", "h-full");
      this.cardDetailContainer.appendChild(this.treeDetail);
      this.startResearchButton = document.createElement("fxs-button");
      this.startResearchButton.classList.add("mt-6");
      this.startResearchButton.setAttribute("caption", "LOC_UI_TREE_START_RESEARCH");
      this.startResearchButton.addEventListener("action-activate", this.startResearchButtonActivateListener);
      this.cardDetailContainer.appendChild(this.startResearchButton);
      waitForLayout(() => {
        const treeDetailScrollable = this.treeDetail?.maybeComponent?.scrollable?.maybeComponent;
        treeDetailScrollable?.setEngineInputProxy(this.Root);
        if (!this.treeDetail?.isConnected && this.cardDetailContainer) {
          this.cardDetailContainer.appendChild(this.treeDetail);
        }
      });
    }
    const node = TechTree.getCard(nodeId);
    if (node == void 0) {
      console.error(
        "screen-tech-tree: updateTreeDetail(): Node with id " + nodeId + " couldn't be found on the grid data"
      );
      return;
    }
    const { isCompleted, isCurrent } = node.unlocksByDepth?.[+level] ?? {};
    this.startResearchButton?.classList.toggle(
      "hidden",
      isCompleted || isCurrent || !ActionHandler.isTouchActive || ActionHandler.isGamepadActive
    );
    this.startResearchButton?.setAttribute("type", nodeId);
    this.startResearchButton?.setAttribute("level", level);
    this.treeDetail.setAttribute("name", node.name);
    this.treeDetail.setAttribute("icon", node.icon);
    this.treeDetail.setAttribute("level", level);
    this.treeDetail.setAttribute("progress", `${node.progressPercentage}`);
    this.treeDetail.setAttribute("turns", `${node.turns}`);
    this.treeDetail.setAttribute("unlocks-by-depth", node.unlocksByDepthString);
    if (node.cost && node.cost != 0) {
      this.treeDetail.setAttribute("cost", node.cost.toString());
      this.treeDetail.setAttribute("cost-icon", "YIELD_SCIENCE");
    }
  }
  close() {
    super.close();
  }
  refreshNavTray() {
    NavTray.addOrUpdateGenericBack();
    const canActivateItem = this.canActivateItem();
    if (canActivateItem) {
      NavTray.addOrUpdateAccept("LOC_UI_TREE_START_RESEARCH");
    } else {
      NavTray.addOrUpdateAccept("LOC_UI_TREE_START_SELECT");
    }
  }
  canActivateItem() {
    if (this.selectedNode) {
      const nodeIndex = +this.selectedNode;
      const args = { ProgressionTreeNodeType: nodeIndex };
      const result = Game.PlayerOperations.canStart(
        GameContext.localPlayerID,
        PlayerOperationTypes.SET_TECH_TREE_NODE,
        args,
        false
      );
      if (result.Success) {
        return true;
      }
    }
    return false;
  }
  onActivateTechlistItem() {
    if (this.selectedNode) {
      const localPlayer = Players.get(GameContext.localPlayerID);
      if (localPlayer) {
        const targetNode = localPlayer.Techs?.getTargetNode();
        if (targetNode != void 0 && targetNode != ProgressionTreeNodeTypes.NO_NODE) {
          this.onTargetTechlistItem();
          return;
        }
      }
      const nodeIndex = +this.selectedNode;
      const args = { ProgressionTreeNodeType: nodeIndex };
      const result = Game.PlayerOperations.canStart(
        GameContext.localPlayerID,
        PlayerOperationTypes.SET_TECH_TREE_NODE,
        args,
        false
      );
      if (result.Success) {
        Game.PlayerOperations.sendRequest(
          GameContext.localPlayerID,
          PlayerOperationTypes.SET_TECH_TREE_NODE,
          args
        );
      }
    }
  }
  onTargetTechlistItem() {
    if (this.selectedNode) {
      const nodeIndex = +this.selectedNode;
      const args = { ProgressionTreeNodeType: nodeIndex };
      const result = Game.PlayerOperations.canStart(
        GameContext.localPlayerID,
        PlayerOperationTypes.SET_TECH_TREE_TARGET_NODE,
        args,
        false
      );
      if (result.Success) {
        if (this.selectedNode != ProgressionTreeNodeTypes.NO_NODE) {
          const result2 = Game.PlayerOperations.canStart(
            GameContext.localPlayerID,
            PlayerOperationTypes.SET_TECH_TREE_NODE,
            args,
            false
          );
          if (result2.Success) {
            Game.PlayerOperations.sendRequest(
              GameContext.localPlayerID,
              PlayerOperationTypes.SET_TECH_TREE_NODE,
              args
            );
          }
        }
        Game.PlayerOperations.sendRequest(
          GameContext.localPlayerID,
          PlayerOperationTypes.SET_TECH_TREE_TARGET_NODE,
          args
        );
      }
    }
  }
  onActiveDeviceTypeChanged() {
    this.refreshNavTray();
    this.cleanPreviousSelectedNode();
    if (this.selectedNode) {
      this.updateTreeDetail(`${this.selectedNode}`, `${this.selectedLevel}`);
    }
  }
  onCardActivate(event) {
    const { type, level } = event.detail;
    if (ActionHandler.isTouchActive && TreeSupport.isSmallScreen()) {
      this.handleCardHover(type, level);
      this.refreshDetailsPanel(type, level);
      return;
    }
    this.handleCardActivate(type, level);
  }
  handleCardActivate(type, level) {
    if (this.canActivateItem()) {
      this.onActivateTechlistItem();
    } else {
      this.onTargetTechlistItem();
    }
    if (this.selectedNode) {
      const card = TechTree.getCard(this.selectedNode.toString());
      if (card) {
        const node = GameInfo.ProgressionTreeNodes.lookup(card.nodeType);
        if (node) {
          const event = "tech-tree-activate-" + node.ProgressionTreeNodeType + "_" + level;
          UI.sendAudioEvent(event);
        } else {
          Audio.playSound("data-audio-tech-tree-activate", "audio-screen-tech-tree-chooser");
        }
      } else {
        Audio.playSound("data-audio-tech-tree-activate", "audio-screen-tech-tree-chooser");
      }
    }
    this.refreshDetailsPanel(type, level);
  }
  onCardHover(event) {
    this.handleCardHover(event.detail.type, event.detail.level);
  }
  handleCardHover(type, level) {
    this.refreshDetailsPanel(type, level);
    if (this.selectedNode) {
      this.handleCardDehover();
      const nodeIndex = +this.selectedNode;
      const highlightList = TechTree.hoverItems(nodeIndex);
      if (highlightList) {
        Audio.playSound("data-audio-queue-hover", "audio-screen-tech-tree");
        for (let index = 0; index < highlightList.length; index++) {
          const setElement = this.Root.querySelector(
            `tree-card-v2[type="${highlightList[index]}"]`
          );
          setElement?.classList.add("hoverqueued");
        }
      }
    } else {
      this.handleCardDehover();
    }
  }
  onCardDehover(_event) {
    this.handleCardDehover();
  }
  handleCardDehover() {
    const clearList = TechTree.clearHoverItems();
    if (clearList) {
      for (let index = 0; index < clearList.length; index++) {
        const clearElement = this.Root.querySelector(
          `tree-card-v2[type="${clearList[index]}"]`
        );
        clearElement?.classList.remove("hoverqueued");
      }
    }
  }
  onStartResearchButtonActivate({ target }) {
    const nodeId = target.getAttribute("type") ?? "";
    const level = target.getAttribute("level") ?? "0";
    this.handleCardActivate(nodeId, level);
    target.classList.add("hidden");
  }
}
Controls.define("screen-tech-tree", {
  createInstance: ScreenTechTree,
  description: "Grid screen for techs.",
  classNames: ["screen-tech-tree", "screen-tree"],
  styles: [styles],
  innerHTML: [content]
});
//# sourceMappingURL=screen-tech-tree.js.map
