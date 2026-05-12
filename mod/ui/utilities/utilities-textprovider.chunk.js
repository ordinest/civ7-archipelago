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
import { g as getModifierTextByContext, c as composeConstructibleDescription } from 'fs://game/core/ui/utilities/utilities-core-textprovider.chunk.js';
import { g as getConstructibleTagsFromType } from 'fs://game/base-standard/ui/utilities/utilities-tags.chunk.js';
import { Icon } from 'fs://game/core/ui/utilities/utilities-image.chunk.js';

console.log("ET CETERA TEXTPROVIDER IS LOADED")

function getUnlockTargetName(targetType, targetKind) {
  if (targetKind == "KIND_MODIFIER") {
    const modInfo = GameInfo.Modifiers.find((o) => o.ModifierId == targetType);
    if (modInfo) {
      const modifierName = getModifierTextByContext(modInfo.ModifierId, "Name");
      return Locale.compose(modifierName) ?? "";
    }
  }
  if (targetKind == "KIND_CONSTRUCTIBLE") {
    const constructibleInfo = GameInfo.Constructibles.find((o) => o.ConstructibleType == targetType);
    if (constructibleInfo) {
      return Locale.compose(constructibleInfo.Name);
    }
  }
  if (targetKind == "KIND_UNIT") {
    const unitInfo = GameInfo.Units.find((o) => o.UnitType == targetType);
    if (unitInfo) {
      return Locale.compose(unitInfo.Name);
    }
  }
  if (targetKind == "KIND_TRADITION") {
    const traditionInfo = GameInfo.Traditions.find((o) => o.TraditionType == targetType);
    if (traditionInfo) {
      return Locale.compose(traditionInfo.Name);
    }
  }
  if (targetKind == "KIND_DIPLOMATIC_ACTION") {
    const diploActionInfo = GameInfo.DiplomacyActions.find((o) => o.DiplomacyActionType == targetType);
    if (diploActionInfo) {
      return Locale.compose(diploActionInfo.Name);
    }
  }
  if (targetKind == "KIND_PROJECT") {
    const projectInfo = GameInfo.Projects.find((o) => o.ProjectType == targetType);
    if (projectInfo) {
      return Locale.compose(projectInfo.Name);
    }
  }
  return targetType;
}
function getUnlockTargetIcon(targetType, targetKind) {
  if (targetKind == "KIND_CONSTRUCTIBLE") {
    const constructibleInfo = GameInfo.Constructibles.find((o) => o.ConstructibleType == targetType);
    if (constructibleInfo) {
      return Icon.getConstructibleIconFromDefinition(constructibleInfo);
    }
  }
  if (targetKind == "KIND_UNIT") {
    const unitInfo = GameInfo.Units.find((o) => o.UnitType == targetType);
    if (unitInfo) {
      return Icon.getUnitIconFromDefinition(unitInfo);
    }
  }
  if (targetKind == "KIND_DIPLOMATIC_ACTION") {
    const actionInfo = GameInfo.DiplomaticProjects_UI_Data.find((o) => o.DiplomacyActionType == targetType);
    let iconURL2 = UI.getIconURL(targetType);
    if (iconURL2 != "") {
      return iconURL2;
    }
    if (actionInfo) {
      switch (actionInfo.DiplomacyActionGroup) {
        case "DIPLOMACY_ACTION_GROUP_ESPIONAGE":
          iconURL2 = UI.getIcon("MOD_ESPIONAGE_UNLOCK");
          return iconURL2;
        default:
          break;
      }
    }
    iconURL2 = UI.getIcon(targetKind + "_UNLOCK");
    return iconURL2;
  }
  let iconURL = UI.getIcon(targetKind + "_UNLOCK");
  if (iconURL != "") {
    return iconURL;
  } else {
    iconURL = UI.getIconURL(targetType);
    if (iconURL != "") {
      return iconURL;
    }
  }
  if (targetKind == "KIND_MODIFIER") {
    return UI.getIconURL("MOD_GENERIC_BONUS");
  }
  console.warn("cannot get icon for unhandled targetType: ", targetType, ",  target kind: ", targetKind);
  return UI.getIconURL("MOD_GENERIC_BONUS");
}
function getUnlockTargetDescriptions(targetType, targetKind) {
  let locStrings = [];
  if (targetKind == "KIND_MODIFIER") {
    const modInfo = GameInfo.Modifiers.find((o) => o.ModifierId == targetType);
    if (modInfo) {
      const modifierDesc = getModifierTextByContext(modInfo.ModifierId, "Description");
      if (modifierDesc) {
        locStrings.push(modifierDesc);
      }
    }
  } else if (targetKind == "KIND_CONSTRUCTIBLE") {
    const tags = getConstructibleTagsFromType(targetType).join(", ");
    const desc = composeConstructibleDescription(targetType);
    if (desc) {
      locStrings.push(
        tags.length > 0 ? `[STYLE:text-2xs text-accent-3 uppercase mb-4]${tags}[/S][N]${desc}` : desc
      );
    }
  } else if (targetKind == "KIND_UNIT") {
    const unitInfo = GameInfo.Units.find((o) => o.UnitType == targetType);
    if (unitInfo) {
      if (unitInfo.Description) {
        locStrings.push(Locale.compose(unitInfo.Description));
      }
    }
  } else if (targetKind == "KIND_TRADITION") {
    locStrings = getTraditionDescriptions(targetType);
  } else if (targetKind == "KIND_DIPLOMATIC_ACTION") {
    const diploActionInfo = GameInfo.DiplomacyActions.find((o) => o.DiplomacyActionType == targetType);
    if (diploActionInfo) {
      locStrings.push(Locale.compose(diploActionInfo.Description));
    }
  } else if (targetKind == "KIND_PROJECT") {
    const projectInfo = GameInfo.Projects.find((o) => o.ProjectType == targetType);
    if (projectInfo) {
      locStrings.push(Locale.compose(projectInfo.Description));
    }
  }
  return locStrings;
}
function getTraditionDescriptions(traditionType) {
  const descStrings = [];
  const traditionInfo = GameInfo.Traditions.lookup(traditionType);
  if (traditionInfo) {
    for (const modifier of GameInfo.TraditionModifiers) {
      if (modifier.TraditionType == traditionInfo.TraditionType) {
        const modifierDesc = getModifierTextByContext(modifier.ModifierId, "Description");
        if (modifierDesc) {
          descStrings.push(modifierDesc);
        }
      }
    }
    if (descStrings.length == 0) {
      if (traditionInfo.Description) {
        descStrings.push(Locale.compose(traditionInfo.Description));
      }
    }
  }
  return descStrings;
}
function getNodeName(nodeData) {
  if (!nodeData) {
    return "";
  }
  const nodeInfo = GameInfo.ProgressionTreeNodes.lookup(nodeData.nodeType);
  if (!nodeInfo) {
    return "";
  }
  //SeelingCat
  let nodeName = nodeInfo.Name ?? nodeInfo.ProgressionTreeNodeType;
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
function getUnlockDepthPrefix(iCurDepth, iMaxDepth) {
  if (iMaxDepth <= 1) {
    return "";
  }
  return iCurDepth + 1 + "/" + iMaxDepth;
}

export { getUnlockTargetDescriptions as a, getUnlockTargetIcon as b, getUnlockTargetName as g };
//# sourceMappingURL=utilities-textprovider.chunk.js.map
