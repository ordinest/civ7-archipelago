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
import { t as template, i as insert, s as setAttribute, c as createArraySignal, I as IsControllerActive, k as defineLegacyComponent, h as ComponentUtilities } from 'fs://game/core/ui-next/components/tooltip-model.chunk.js';
import { e as createMemo, d as createComponent, F as For, f as createRenderEffect, S as Show, c as createSignal, o as onMount, b as onCleanup } from 'fs://game/core/ui-next/services/model-registry.chunk.js';
import ContextManager from 'fs://game/core/ui/context-manager/context-manager.js';
import { Icon } from 'fs://game/core/ui/utilities/utilities-image.chunk.js';
import { V as ViewManager } from 'fs://game/core/ui/views/view-manager.chunk.js';
import { B as Button } from 'fs://game/core/ui-next/components/button.chunk.js';
import { S as SidebarChooser, I as InnerFrame } from 'fs://game/base-standard/ui-next/components/side-chooser.chunk.js';
import { L as L10n } from 'fs://game/core/ui-next/components/slot.chunk.js';
import { S as ScrollArea } from 'fs://game/core/ui-next/components/scroll-area.chunk.js';
import { c as TreeNodesSupport } from 'fs://game/base-standard/ui/tree-grid/tree-support.chunk.js';
import { A as AdvisorUtilities } from 'fs://game/base-standard/ui/tutorial/tutorial-support.chunk.js';
import { T as TechCivicTooltip, b as buildUnlockDisplayData, h as hasUnlockContent } from 'fs://game/base-standard/ui-next/tooltips/tech-civic-tooltip.chunk.js';
import { C as ChooserItem } from 'fs://game/core/ui-next/components/chooser-item.chunk.js';
import { c as TooltipHorizontalPosition, b as TooltipVerticalPosition } from 'fs://game/core/ui-next/components/tooltip.chunk.js';
import { a as AdvisorRecommendationsList } from 'fs://game/base-standard/ui-next/components/pills.chunk.js';
import 'fs://game/core/ui/input/focus-manager.js';
import 'fs://game/core/ui/audio-base/audio-support.chunk.js';
import 'fs://game/core/ui/framework.chunk.js';
import 'fs://game/core/ui/navigation-tray/model-navigation-tray.chunk.js';
import 'fs://game/core/ui/input/action-handler.js';
import 'fs://game/core/ui/input/cursor.js';
import 'fs://game/core/ui/panel-support.chunk.js';
import 'fs://game/core/ui/input/input-support.chunk.js';
import 'fs://game/core/ui/utilities/utilities-update-gate.chunk.js';
import 'fs://game/core/ui/input/focus-support.chunk.js';
import 'fs://game/core/ui/spatial/spatial-manager.js';
import 'fs://game/core/ui/context-manager/display-queue-manager.js';
import 'fs://game/core/ui/dialog-box/manager-dialog-box.chunk.js';
import 'fs://game/core/ui/utilities/utilities-component-id.chunk.js';
import 'fs://game/core/ui-next/components/activatable.chunk.js';
import 'fs://game/core/ui-next/components/filigree-title.chunk.js';
import 'fs://game/core/ui-next/components/filigree.chunk.js';
import 'fs://game/core/ui-next/components/header.chunk.js';
import 'fs://game/core/ui-next/components/close-button.chunk.js';
import 'fs://game/core/ui-next/components/panel.chunk.js';
import 'fs://game/base-standard/ui/mini-map/panel-mini-map.js';
import 'fs://game/core/ui/lenses/lens-manager.chunk.js';
import 'fs://game/core/ui/shell/mp-staging/mp-friends.js';
import 'fs://game/core/ui/shell/mp-staging/model-mp-friends.chunk.js';
import 'fs://game/core/ui/social-notifications/social-notifications-manager.js';
import 'fs://game/core/ui/utilities/utilities-layout.chunk.js';
import 'fs://game/core/ui/utilities/utilities-dom.chunk.js';
import 'fs://game/core/ui/utilities/utilities-liveops.js';
import 'fs://game/core/ui/utilities/utilities-network.js';
import 'fs://game/core/ui/shell/mp-legal/mp-legal.js';
import 'fs://game/core/ui/events/shell-events.chunk.js';
import 'fs://game/core/ui/utilities/utilities-network-constants.chunk.js';
import 'fs://game/core/ui/utilities/utilities-core-databinding.chunk.js';
import 'fs://game/core/ui-next/components/nav-help.chunk.js';
import 'fs://game/core/ui/components/fxs-nav-help.chunk.js';
import 'fs://game/base-standard/ui/quest-tracker/quest-item.js';
import 'fs://game/base-standard/ui/quest-tracker/quest-tracker.js';
import 'fs://game/core/ui/utilities/utility-serialize.chunk.js';
import 'fs://game/base-standard/ui/tutorial/tutorial-item.js';
import 'fs://game/base-standard/ui/tutorial/tutorial-manager.js';
import 'fs://game/core/ui/input/input-filter.chunk.js';
import 'fs://game/base-standard/ui/tutorial/tutorial-events.chunk.js';
import 'fs://game/core/ui/utilities/utilities-core-textprovider.chunk.js';
import 'fs://game/base-standard/ui/utilities/utilities-tags.chunk.js';
import 'fs://game/core/ui/components/fxs-chooser-item.chunk.js';
import 'fs://game/core/ui/components/fxs-activatable.chunk.js';
import 'fs://game/core/ui-next/utilities/game-core-utilities.chunk.js';

var _tmpl$$1 = /* @__PURE__ */ template(`<div class="flex flex-col items-stretch pointer-events-none mb-2 relative flex-auto min-w-0"><div class="font-title text-xs mt-2\\.5 mb-1 mr-2 ml-px uppercase tracking-100 truncate"></div><div class="flex flex-row flex-wrap ml-px"></div></div>`), _tmpl$2$1 = /* @__PURE__ */ template(`<div class="relative flex flex-col items-end justify-end"><div class="flex flex-col grow items-end px-2 pt-2\\.5 pb-1\\.5 justify-between"><div class="flex flex-row justify-end items-center"><div class="tree-chooser-item__turns-clock relative pointer-events-none size-8 -top-1\\.5 bg-contain bg-no-repeat bg-center"></div><div class="font-title text-sm font-bold"></div></div></div></div>`), _tmpl$3$1 = /* @__PURE__ */ template(`<div class="flex flex-col items-center justify-end my-2 mx-3"><div class="font-title text-xs"></div><div class="bg-black relative w-11 h-2"><div class="tree-chooser-item__percent-bar-fill absolute h-full"></div></div></div>`), _tmpl$4 = /* @__PURE__ */ template(`<div class="flex items-stretch w-9 h-9 mr-1\\.5 mb-2\\.5"><img class="pointer-events-none w-9 h-9"></div>`);
function CultureChooserItem(props) {
  const pctLabel = createMemo(() => `${props.node.progress ?? 0}%`);
  const currentDepthUnlocks = createMemo(() => {
    const depthIndex = props.node.currentDepthIndex ?? 0;
    return props.node.unlocksByDepth[depthIndex]?.unlocks ?? [];
  });
  return createComponent(TechCivicTooltip, {
    get node() {
      return {
        name: props.node.name,
        unlocksByDepth: props.node.unlocksByDepth,
        cost: props.node.cost,
        recommendations: props.node.recommendations,
        currentDepthIndex: props.node.currentDepthIndex
      };
    },
    isCulture: true,
    get initialVPosition() {
      return TooltipVerticalPosition.CENTER;
    },
    get initialHPosition() {
      return TooltipHorizontalPosition.RIGHT;
    },
    get children() {
      return createComponent(ChooserItem, {
        name: "CultureChooserItem",
        "class": "culture-item self-stretch my-1\\.25 text-accent-2 pointer-events-auto",
        get icon() {
          return props.node.icon;
        },
        selectOnActivate: true,
        audio: {
          group: "audio-screen-culture-tree-chooser",
          onFocus: "data-audio-chooser-focus",
          onActivate: "data-audio-culture-tree-activate"
        },
        onActivate: () => {
          props.onSelect(props.node.id);
          const nodeDef = GameInfo.ProgressionTreeNodes.lookup(props.node.id);
          if (nodeDef) {
            const event = "civic-tree-activate-" + nodeDef.ProgressionTreeNodeType + "_" + props.node.currentDepthIndex;
            UI.sendAudioEvent(event);
          }
        },
        get ["node-tree-type"]() {
          return String(props.node.treeType);
        },
        get ["node-id"]() {
          return String(props.node.id);
        },
        hotkeyAction: "accept",
        navTrayText: "LOC_GENERIC_ACCEPT",
        get children() {
          return [(() => {
            var _el$ = _tmpl$$1(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
            insert(_el$2, () => props.node.name);
            insert(_el$3, createComponent(For, {
              get each() {
                return currentDepthUnlocks();
              },
              children: (unlock) => (() => {
                var _el$13 = _tmpl$4(), _el$14 = _el$13.firstChild;
                createRenderEffect(() => setAttribute(_el$14, "src", unlock.icon));
                return _el$13;
              })()
            }));
            return _el$;
          })(), (() => {
            var _el$4 = _tmpl$2$1(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling;
            insert(_el$8, () => props.node.turns);
            insert(_el$5, createComponent(AdvisorRecommendationsList, {
              get recommendations() {
                return props.node.recommendations;
              },
              direction: "horizontal",
              iconOnly: true
            }), null);
            return _el$4;
          })(), createComponent(Show, {
            get when() {
              return props.node.isLocked;
            },
            get children() {
              var _el$9 = _tmpl$3$1(), _el$10 = _el$9.firstChild, _el$11 = _el$10.nextSibling, _el$12 = _el$11.firstChild;
              insert(_el$10, pctLabel);
              createRenderEffect((_$p) => (_$p = `${props.node.progress ?? 0}%`) != null ? _el$12.style.setProperty("width", _$p) : _el$12.style.removeProperty("width"));
              return _el$9;
            }
          })];
        }
      });
    }
  });
}

const style = "fs://game/base-standard/ui-next/screens/choosers/culture-chooser/culture-chooser.css";

var _tmpl$ = /* @__PURE__ */ template(`<div class="culture-tree-currently-studying self-center w-96"><div class="text-accent-4 uppercase mt-1 font-title text-sm tracking-100"></div><div class="filigree-divider-inner-frame w-72 my-1\\.5 self-center"></div></div>`), _tmpl$2 = /* @__PURE__ */ template(`<div class="mt-4 mb-2\\.5 font-title text-base w-96 self-center uppercase text-center"></div>`), _tmpl$3 = /* @__PURE__ */ template(`<div class="flex justify-center items-center w-full min-w-16 font-body text-sm text-accent-4 text-center"></div>`);
function getCultureNodeName(nodeData) {
  const def = GameInfo.ProgressionTreeNodes.lookup(nodeData.nodeType);
  if (!def) return "";
  //SeelingCat
  let nodeName = def.Name ?? def.ProgressionTreeNodeType;
  if (nodeData.depthUnlocked >= 1) {
    let depthNumeral = nodeData.depthUnlocked + 1;
    if (Locale.keyExists(nodeName + "_" + depthNumeral)) {
      nodeName = Locale.compose("LOC_UI_TREE_MASTERY") + ": " + Locale.compose(nodeName + "_" + depthNumeral)
      return Locale.compose(nodeName);
    }
    else {
      nodeName = Locale.compose(nodeName)
      depthNumeral = Locale.toRomanNumeral(nodeData.depthUnlocked + 1)
      nodeName += " " + depthNumeral
      return Locale.compose(nodeName);
    }
  }
  return Locale.compose(nodeName);
  //SeelingCat
}
function buildCultureNodeData(player, nodeType, isActiveResearch = false) {
  const nodeDef = GameInfo.ProgressionTreeNodes.lookup(nodeType);
  const nodeData = Game.ProgressionTrees.getNode(player.id, nodeType);
  if (!nodeDef || !nodeData) return null;
  const unlocksByDepth = [];
  const treeNodeUnlocks = TreeNodesSupport.getValidNodeUnlocks(nodeData);
  const removableUnlocks = TreeNodesSupport.getRepeatedUniqueUnits(treeNodeUnlocks);
  for (const idx of nodeData.unlockIndices) {
    const unlockInfo = GameInfo.ProgressionTreeNodeUnlocks[idx];
    if (!unlockInfo || unlockInfo.Hidden) continue;
    if (unlockInfo.TargetKind === "KIND_UNIT") {
      const p = Players.get(GameContext.localPlayerID);
      if (p && p.Units?.isBuildPermanentlyDisabled(unlockInfo.TargetType)) continue;
      if (removableUnlocks.includes(unlockInfo.TargetType)) continue;
    }
    const unlockDisplayData = buildUnlockDisplayData(unlockInfo);
    const hasInfo = unlockDisplayData.nameKey.length > 0 || hasUnlockContent(unlockDisplayData.descriptionData);
    if (!hasInfo) continue;
    while (unlocksByDepth.length < unlockInfo.UnlockDepth) {
      const depthIndex = unlocksByDepth.length;
      const isCompleted = depthIndex < nodeData.depthUnlocked;
      const isCurrent = isActiveResearch && depthIndex === nodeData.depthUnlocked;
      unlocksByDepth.push({
        header: "",
        unlocks: [],
        isCompleted,
        isCurrent,
        isLocked: false
      });
    }
    const depthIdx = unlockInfo.UnlockDepth - 1;
    if (unlockDisplayData.icon) {
      unlocksByDepth[depthIdx].unlocks.push(unlockDisplayData);
    }
  }
  const cultureRecommendations = AdvisorUtilities.getTreeRecommendations(AdvisorySubjectTypes.CHOOSE_CULTURE);
  const recommendations = AdvisorUtilities.getTreeRecommendationIcons(cultureRecommendations, nodeType).map((rec) => rec.class);
  const playerCulture = player?.Culture;
  const cost = playerCulture?.getNodeCost(nodeType) ?? -1;
  const turns = playerCulture?.getTurnsForNode(nodeType) ?? -1;
  return {
    id: nodeType,
    name: getCultureNodeName(nodeData),
    icon: Icon.getCultureIconFromProgressionTreeNodeDefinition(nodeDef),
    turns,
    treeType: nodeDef.ProgressionTree,
    unlocksByDepth,
    recommendations,
    isLocked: false,
    cost,
    progress: nodeData.progress ?? 0,
    currentDepthIndex: nodeData.depthUnlocked
  };
}
function getActiveCultureNodeType(player) {
  const cultureTreeType = player?.Culture?.getActiveTree();
  if (cultureTreeType === void 0) return void 0;
  const treeObject = Game.ProgressionTrees.getTree(player.id, cultureTreeType);
  return treeObject?.nodes?.[treeObject.activeNodeIndex]?.nodeType;
}
function getAllCultureNodes(player) {
  const out = [];
  const available = player?.Culture?.getAllAvailableNodeTypes?.();
  if (!available) return out;
  const activeNodeType = getActiveCultureNodeType(player);
  for (const nodeType of available) {
    // civ7-archipelago: hidden AP nodes are internal grant targets,
    // not player-researchable. Skip from the chooser.
    const info = GameInfo.ProgressionTreeNodes.lookup(nodeType);
    if (info && info.ProgressionTreeNodeType
        && String(info.ProgressionTreeNodeType).indexOf("NODE_AP_") === 0) {
      continue;
    }
    const isActiveResearch = nodeType === activeNodeType;
    const node = buildCultureNodeData(player, nodeType, isActiveResearch);
    if (node) out.push(node);
  }
  out.sort((node, nodeNext) => {
    const treeType = `${node.treeType}`;
    const treeTypeNext = `${nodeNext.treeType}`;
    const isFirstMainTree = treeType.includes("MAIN");
    const areBothMainTree = treeType.includes("MAIN") && treeTypeNext.includes("MAIN");
    if (areBothMainTree) {
      return node.turns - nodeNext.turns;
    } else if (isFirstMainTree) {
      return -1;
    } else {
      return 1;
    }
  });
  return out;
}
function chooseCulture(nodeId) {
  const nodeIndex = nodeId;
  const args = {
    ProgressionTreeNodeType: nodeIndex
  };
  const result = Game.PlayerOperations.canStart(GameContext.localPlayerID, PlayerOperationTypes.SET_CULTURE_TREE_NODE, args, false);
  if (result?.Success) {
    Game.PlayerOperations.sendRequest(GameContext.localPlayerID, PlayerOperationTypes.SET_CULTURE_TREE_NODE, args);
  }
}
function openFullTree(defaultNode) {
  const player = Players.get(GameContext.localPlayerID);
  const trees = player?.Culture?.getAvailableTrees();
  const treeCSV = trees?.join(",");
  if (!treeCSV) {
    console.error("No culture trees available to open.");
    return;
  }
  let targetNode = defaultNode;
  if (player) {
    const activeTree = player.Culture?.getActiveTree();
    if (activeTree !== void 0) {
      const treeObject = Game.ProgressionTrees.getTree(player.id, activeTree);
      if (treeObject && treeObject.activeNodeIndex < 0) {
        targetNode = void 0;
      }
    }
  }
  const treeParent = document.querySelector(".fxs-trees") ?? void 0;
  ContextManager.push("screen-culture-tree", {
    singleton: true,
    createMouseGuard: true,
    targetParent: treeParent
  });
  if (treeCSV) {
    window.dispatchEvent(new CustomEvent("view-culture-progression-tree", {
      detail: {
        treeCSV,
        targetNode,
        iconCallback: Icon.getCultureIconFromProgressionTreeNodeDefinition
      }
    }));
  }
  ContextManager.pop("screen-culture-tree-chooser");
}
const CultureTreeChooser = () => {
  let resetInputContext = true;
  const [getClosing, setClosing] = createSignal(false);
  const [allNodes, mutateNodes] = createArraySignal([]);
  const inProgressNode = createMemo(() => {
    const nodes = allNodes();
    for (const node of nodes) {
      const currentDepth = node.unlocksByDepth[node.currentDepthIndex];
      if (currentDepth?.isCurrent) return node;
    }
    return void 0;
  });
  const defaultNode = createMemo(() => inProgressNode()?.id ?? allNodes()[0]?.id);
  function refresh() {
    const player = Players.get(GameContext.localPlayerID);
    if (!player) return;
    const nodes = getAllCultureNodes(player);
    mutateNodes((arr) => {
      arr.length = 0;
      arr.push(...nodes);
    });
  }
  function handleSelect(id) {
    chooseCulture(id);
    const args = {
      ProgressionTreeNodeType: ProgressionTreeNodeTypes.NO_NODE
    };
    Game.PlayerOperations.sendRequest(GameContext.localPlayerID, PlayerOperationTypes.SET_CULTURE_TREE_TARGET_NODE, args);
    setClosing(true);
    UI.sendAudioEvent("culture-tree-chooser-panel-hiding");
  }
  function handleOpenFullTree() {
    resetInputContext = false;
    openFullTree(defaultNode());
  }
  onMount(() => {
    refresh();
    const listener = (data) => {
      if (data?.player !== void 0 && data.player !== GameContext.localPlayerID) return;
      refresh();
    };
    UI.sendAudioEvent("culture-tree-chooser-panel-showing");
    const events = ["CultureYieldChanged", "CultureTreeChanged", "CultureTargetChanged", "CultureNodeCompleted", "PlayerTurnActivated", "LocalPlayerTurnBegin", "LocalPlayerChanged"];
    for (const e of events) engine.on(e, listener);
    onCleanup(() => {
      for (const e of events) engine.off(e, listener);
      if (resetInputContext) {
        Input.setActiveContext(ViewManager.current.getInputContext());
      }
    });
  });
  return createComponent(SidebarChooser, {
    context: "screen-culture-tree-chooser",
    title: "LOC_UI_CULTURE_CHOOSER_TITLE",
    id: "culture-tree-chooser",
    name: "culture-tree-chooser",
    closeButtonAudioGroup: "audio-screen-culture-tree-chooser",
    get closing() {
      return getClosing();
    },
    get children() {
      return [createComponent(InnerFrame, {
        "class": "my-1\\.5",
        get children() {
          var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
          insert(_el$2, createComponent(L10n.Compose, {
            text: "LOC_UI_CURRENT_STUDY"
          }));
          insert(_el$, createComponent(Show, {
            get when() {
              return inProgressNode();
            },
            get fallback() {
              return (() => {
                var _el$5 = _tmpl$3();
                insert(_el$5, createComponent(L10n.Compose, {
                  text: "LOC_UI_CULTURE_RESEARCH_EMPTY"
                }));
                return _el$5;
              })();
            },
            children: (node) => createComponent(CultureChooserItem, {
              get node() {
                return node();
              },
              onSelect: handleSelect
            })
          }), null);
          return _el$;
        }
      }), (() => {
        var _el$4 = _tmpl$2();
        insert(_el$4, createComponent(L10n.Compose, {
          text: "LOC_UI_CULTURE_CHOOSE_CIVIC_HEADER"
        }));
        return _el$4;
      })(), createComponent(ScrollArea, {
        "class": "flex-1",
        get children() {
          return createComponent(For, {
            get each() {
              return allNodes();
            },
            children: (node) => createComponent(CultureChooserItem, {
              node,
              onSelect: handleSelect
            })
          });
        }
      }), createComponent(Button, {
        name: "OpenFullTree",
        "class": "mx-8 mt-3 mb-6 uppercase",
        get classList() {
          return {
            hidden: IsControllerActive()
          };
        },
        audio: {
          group: "audio-screen-culture-tree-chooser",
          onFocus: "culture-tree-chooser-focus"
        },
        get disableFocus() {
          return IsControllerActive();
        },
        hotkeyAction: "shell-action-1",
        navTrayText: "LOC_UI_CULTURE_TREE_VIEW_FULL_TREE_BUTTON",
        onActivate: handleOpenFullTree,
        get children() {
          return createComponent(L10n.Compose, {
            text: "LOC_UI_CULTURE_TREE_VIEW_FULL_TREE_BUTTON"
          });
        }
      })];
    }
  });
};
window.addEventListener("hotkey-open-civics", () => {
  if (ContextManager.isCurrentClass("screen-culture-tree-chooser")) {
    ContextManager.pop("screen-culture-tree-chooser");
  } else {
    ContextManager.push("screen-culture-tree-chooser", {
      singleton: true
    });
  }
});
defineLegacyComponent("screen-culture-tree-chooser", {
  classNames: ["screen-culture-tree-chooser"],
  tabIndex: 0
}, (_attrs, _element) => {
  Input.setActiveContext(InputContext.Shell);
  return createComponent(CultureTreeChooser, {});
});
ComponentUtilities.loadStyles(style);
//# sourceMappingURL=culture-chooser.js.map
