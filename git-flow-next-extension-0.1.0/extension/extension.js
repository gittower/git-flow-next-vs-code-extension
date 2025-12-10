"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var import_child_process = require("child_process");
var import_util = require("util");
var execAsync = (0, import_util.promisify)(import_child_process.exec);
function activate(context) {
  console.log("Git Flow Next extension is now active!");
  console.log("Extension context:", context.extension.id);
  vscode.window.showInformationMessage("Git Flow Next Extension Activated!");
  async function executeGitFlowCommand(command, args = [], options = {}) {
    const { showOutput = true, showError = true } = options;
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error("No workspace folder open. Please open a git repository folder.");
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const fullCommand = `git flow ${command} ${args.join(" ")}`;
    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: workspacePath
      });
      if (stderr && showError) {
        console.error(`Git Flow Error: ${stderr}`);
      }
      if (showOutput && stdout.trim()) {
        vscode.window.showInformationMessage(`Git Flow: ${stdout.trim()}`);
      }
      return stdout;
    } catch (error) {
      const errorMessage = error.message || error.toString();
      if (showError) {
        vscode.window.showErrorMessage(`Git Flow Error: ${errorMessage}`);
      }
      throw error;
    }
  }
  async function getCurrentBranch() {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error("No workspace folder open. Please open a git repository folder.");
    }
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    try {
      const { stdout } = await execAsync("git branch --show-current", {
        cwd: workspacePath
      });
      const branchName = stdout.trim();
      if (branchName.startsWith("feature/")) {
        return {
          type: "feature",
          name: branchName.replace("feature/", ""),
          fullName: branchName
        };
      } else if (branchName.startsWith("release/")) {
        return {
          type: "release",
          name: branchName.replace("release/", ""),
          fullName: branchName
        };
      } else if (branchName.startsWith("hotfix/")) {
        return {
          type: "hotfix",
          name: branchName.replace("hotfix/", ""),
          fullName: branchName
        };
      } else if (branchName.startsWith("support/")) {
        return {
          type: "support",
          name: branchName.replace("support/", ""),
          fullName: branchName
        };
      } else if (branchName.startsWith("bugfix/")) {
        return {
          type: "bugfix",
          name: branchName.replace("bugfix/", ""),
          fullName: branchName
        };
      } else if (branchName === "main" || branchName === "master") {
        return {
          type: "main",
          name: branchName,
          fullName: branchName
        };
      } else if (branchName === "develop") {
        return {
          type: "develop",
          name: branchName,
          fullName: branchName
        };
      } else {
        return {
          type: "unknown",
          name: branchName,
          fullName: branchName
        };
      }
    } catch (error) {
      throw new Error("Not in a git repository");
    }
  }
  async function promptForInput(prompt, placeholder) {
    return await vscode.window.showInputBox({
      prompt,
      placeHolder: placeholder,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Please enter a valid value";
        }
        return null;
      }
    });
  }
  async function showBranchSelection(branches, prompt) {
    if (branches.length === 0) {
      vscode.window.showInformationMessage("No branches found");
      return void 0;
    }
    return await vscode.window.showQuickPick(branches, {
      placeHolder: prompt
    });
  }
  const initCommand = vscode.commands.registerCommand("git-flow-next.init", async () => {
    try {
      const preset = await vscode.window.showQuickPick([
        { label: "Classic", description: "Traditional GitFlow with main, develop, feature, release, hotfix" },
        { label: "GitHub", description: "GitHub Flow with main and feature branches" },
        { label: "GitLab", description: "GitLab Flow with production, staging, main, feature, and hotfix" },
        { label: "Custom", description: "Custom configuration with interactive setup" }
      ], {
        placeHolder: "Select a Git Flow preset"
      });
      if (!preset)
        return;
      const presetMap = {
        "Classic": "classic",
        "GitHub": "github",
        "GitLab": "gitlab",
        "Custom": "custom"
      };
      const args = preset.label === "Custom" ? ["--custom"] : [`--preset=${presetMap[preset.label]}`];
      await executeGitFlowCommand("init", args);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize Git Flow: ${error}`);
    }
  });
  const featureStartCommand = vscode.commands.registerCommand("git-flow-next.feature.start", async () => {
    const featureName = await promptForInput("Enter feature name", "my-feature");
    if (featureName) {
      await executeGitFlowCommand("feature start", [featureName]);
    }
  });
  const featureFinishCommand = vscode.commands.registerCommand("git-flow-next.feature.finish", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "feature") {
        await executeGitFlowCommand("feature finish", [branchInfo.name]);
      } else {
        const output = await executeGitFlowCommand("feature list", [], { showOutput: false });
        const features = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
        const selectedFeature = await showBranchSelection(features, "Select feature to finish");
        if (selectedFeature) {
          await executeGitFlowCommand("feature finish", [selectedFeature]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to finish feature: ${error}`);
    }
  });
  const featureListCommand = vscode.commands.registerCommand("git-flow-next.feature.list", async () => {
    await executeGitFlowCommand("feature list");
  });
  const featureCheckoutCommand = vscode.commands.registerCommand("git-flow-next.feature.checkout", async () => {
    try {
      const output = await executeGitFlowCommand("feature list", [], { showOutput: false });
      const features = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedFeature = await showBranchSelection(features, "Select feature to checkout");
      if (selectedFeature) {
        await executeGitFlowCommand("feature checkout", [selectedFeature]);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to checkout feature: ${error}`);
    }
  });
  const featureDeleteCommand = vscode.commands.registerCommand("git-flow-next.feature.delete", async () => {
    try {
      const output = await executeGitFlowCommand("feature list", [], { showOutput: false });
      const features = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedFeature = await showBranchSelection(features, "Select feature to delete");
      if (selectedFeature) {
        const confirmed = await vscode.window.showWarningMessage(
          `Are you sure you want to delete feature "${selectedFeature}"?`,
          "Yes",
          "No"
        );
        if (confirmed === "Yes") {
          await executeGitFlowCommand("feature delete", [selectedFeature]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete feature: ${error}`);
    }
  });
  const featureRenameCommand = vscode.commands.registerCommand("git-flow-next.feature.rename", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "feature") {
        const newName = await promptForInput("Enter new feature name", branchInfo.name);
        if (newName) {
          await executeGitFlowCommand("feature rename", [newName]);
        }
      } else {
        vscode.window.showWarningMessage("You must be on a feature branch to rename it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename feature: ${error}`);
    }
  });
  const featureUpdateCommand = vscode.commands.registerCommand("git-flow-next.feature.update", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "feature") {
        await executeGitFlowCommand("feature update", [branchInfo.name]);
      } else {
        vscode.window.showWarningMessage("You must be on a feature branch to update it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update feature: ${error}`);
    }
  });
  const releaseStartCommand = vscode.commands.registerCommand("git-flow-next.release.start", async () => {
    const version = await promptForInput("Enter release version", "1.0.0");
    if (version) {
      await executeGitFlowCommand("release start", [version]);
    }
  });
  const releaseFinishCommand = vscode.commands.registerCommand("git-flow-next.release.finish", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "release") {
        await executeGitFlowCommand("release finish", [branchInfo.name]);
      } else {
        const output = await executeGitFlowCommand("release list", [], { showOutput: false });
        const releases = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
        const selectedRelease = await showBranchSelection(releases, "Select release to finish");
        if (selectedRelease) {
          await executeGitFlowCommand("release finish", [selectedRelease]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to finish release: ${error}`);
    }
  });
  const releaseListCommand = vscode.commands.registerCommand("git-flow-next.release.list", async () => {
    await executeGitFlowCommand("release list");
  });
  const releaseCheckoutCommand = vscode.commands.registerCommand("git-flow-next.release.checkout", async () => {
    try {
      const output = await executeGitFlowCommand("release list", [], { showOutput: false });
      const releases = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedRelease = await showBranchSelection(releases, "Select release to checkout");
      if (selectedRelease) {
        await executeGitFlowCommand("release checkout", [selectedRelease]);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to checkout release: ${error}`);
    }
  });
  const releaseDeleteCommand = vscode.commands.registerCommand("git-flow-next.release.delete", async () => {
    try {
      const output = await executeGitFlowCommand("release list", [], { showOutput: false });
      const releases = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedRelease = await showBranchSelection(releases, "Select release to delete");
      if (selectedRelease) {
        const confirmed = await vscode.window.showWarningMessage(
          `Are you sure you want to delete release "${selectedRelease}"?`,
          "Yes",
          "No"
        );
        if (confirmed === "Yes") {
          await executeGitFlowCommand("release delete", [selectedRelease]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete release: ${error}`);
    }
  });
  const releaseRenameCommand = vscode.commands.registerCommand("git-flow-next.release.rename", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "release") {
        const newName = await promptForInput("Enter new release version", branchInfo.name);
        if (newName) {
          await executeGitFlowCommand("release rename", [newName]);
        }
      } else {
        vscode.window.showWarningMessage("You must be on a release branch to rename it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename release: ${error}`);
    }
  });
  const releaseUpdateCommand = vscode.commands.registerCommand("git-flow-next.release.update", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "release") {
        await executeGitFlowCommand("release update", [branchInfo.name]);
      } else {
        vscode.window.showWarningMessage("You must be on a release branch to update it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update release: ${error}`);
    }
  });
  const hotfixStartCommand = vscode.commands.registerCommand("git-flow-next.hotfix.start", async () => {
    const version = await promptForInput("Enter hotfix version", "1.0.1");
    if (version) {
      await executeGitFlowCommand("hotfix start", [version]);
    }
  });
  const hotfixFinishCommand = vscode.commands.registerCommand("git-flow-next.hotfix.finish", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "hotfix") {
        await executeGitFlowCommand("hotfix finish", [branchInfo.name]);
      } else {
        const output = await executeGitFlowCommand("hotfix list", [], { showOutput: false });
        const hotfixes = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
        const selectedHotfix = await showBranchSelection(hotfixes, "Select hotfix to finish");
        if (selectedHotfix) {
          await executeGitFlowCommand("hotfix finish", [selectedHotfix]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to finish hotfix: ${error}`);
    }
  });
  const hotfixListCommand = vscode.commands.registerCommand("git-flow-next.hotfix.list", async () => {
    await executeGitFlowCommand("hotfix list");
  });
  const hotfixCheckoutCommand = vscode.commands.registerCommand("git-flow-next.hotfix.checkout", async () => {
    try {
      const output = await executeGitFlowCommand("hotfix list", [], { showOutput: false });
      const hotfixes = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedHotfix = await showBranchSelection(hotfixes, "Select hotfix to checkout");
      if (selectedHotfix) {
        await executeGitFlowCommand("hotfix checkout", [selectedHotfix]);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to checkout hotfix: ${error}`);
    }
  });
  const hotfixDeleteCommand = vscode.commands.registerCommand("git-flow-next.hotfix.delete", async () => {
    try {
      const output = await executeGitFlowCommand("hotfix list", [], { showOutput: false });
      const hotfixes = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedHotfix = await showBranchSelection(hotfixes, "Select hotfix to delete");
      if (selectedHotfix) {
        const confirmed = await vscode.window.showWarningMessage(
          `Are you sure you want to delete hotfix "${selectedHotfix}"?`,
          "Yes",
          "No"
        );
        if (confirmed === "Yes") {
          await executeGitFlowCommand("hotfix delete", [selectedHotfix]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete hotfix: ${error}`);
    }
  });
  const hotfixRenameCommand = vscode.commands.registerCommand("git-flow-next.hotfix.rename", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "hotfix") {
        const newName = await promptForInput("Enter new hotfix version", branchInfo.name);
        if (newName) {
          await executeGitFlowCommand("hotfix rename", [newName]);
        }
      } else {
        vscode.window.showWarningMessage("You must be on a hotfix branch to rename it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename hotfix: ${error}`);
    }
  });
  const hotfixUpdateCommand = vscode.commands.registerCommand("git-flow-next.hotfix.update", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "hotfix") {
        await executeGitFlowCommand("hotfix update", [branchInfo.name]);
      } else {
        vscode.window.showWarningMessage("You must be on a hotfix branch to update it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update hotfix: ${error}`);
    }
  });
  const supportStartCommand = vscode.commands.registerCommand("git-flow-next.support.start", async () => {
    const version = await promptForInput("Enter support version", "1.0");
    if (version) {
      await executeGitFlowCommand("support start", [version]);
    }
  });
  const supportFinishCommand = vscode.commands.registerCommand("git-flow-next.support.finish", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "support") {
        await executeGitFlowCommand("support finish", [branchInfo.name]);
      } else {
        const output = await executeGitFlowCommand("support list", [], { showOutput: false });
        const supports = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
        const selectedSupport = await showBranchSelection(supports, "Select support to finish");
        if (selectedSupport) {
          await executeGitFlowCommand("support finish", [selectedSupport]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to finish support: ${error}`);
    }
  });
  const supportListCommand = vscode.commands.registerCommand("git-flow-next.support.list", async () => {
    await executeGitFlowCommand("support list");
  });
  const supportCheckoutCommand = vscode.commands.registerCommand("git-flow-next.support.checkout", async () => {
    try {
      const output = await executeGitFlowCommand("support list", [], { showOutput: false });
      const supports = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedSupport = await showBranchSelection(supports, "Select support to checkout");
      if (selectedSupport) {
        await executeGitFlowCommand("support checkout", [selectedSupport]);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to checkout support: ${error}`);
    }
  });
  const supportDeleteCommand = vscode.commands.registerCommand("git-flow-next.support.delete", async () => {
    try {
      const output = await executeGitFlowCommand("support list", [], { showOutput: false });
      const supports = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedSupport = await showBranchSelection(supports, "Select support to delete");
      if (selectedSupport) {
        const confirmed = await vscode.window.showWarningMessage(
          `Are you sure you want to delete support "${selectedSupport}"?`,
          "Yes",
          "No"
        );
        if (confirmed === "Yes") {
          await executeGitFlowCommand("support delete", [selectedSupport]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete support: ${error}`);
    }
  });
  const supportRenameCommand = vscode.commands.registerCommand("git-flow-next.support.rename", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "support") {
        const newName = await promptForInput("Enter new support version", branchInfo.name);
        if (newName) {
          await executeGitFlowCommand("support rename", [newName]);
        }
      } else {
        vscode.window.showWarningMessage("You must be on a support branch to rename it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename support: ${error}`);
    }
  });
  const supportUpdateCommand = vscode.commands.registerCommand("git-flow-next.support.update", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "support") {
        await executeGitFlowCommand("support update", [branchInfo.name]);
      } else {
        vscode.window.showWarningMessage("You must be on a support branch to update it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update support: ${error}`);
    }
  });
  const bugfixStartCommand = vscode.commands.registerCommand("git-flow-next.bugfix.start", async () => {
    const bugfixName = await promptForInput("Enter bugfix name", "my-bugfix");
    if (bugfixName) {
      await executeGitFlowCommand("bugfix start", [bugfixName]);
    }
  });
  const bugfixFinishCommand = vscode.commands.registerCommand("git-flow-next.bugfix.finish", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "bugfix") {
        await executeGitFlowCommand("bugfix finish", [branchInfo.name]);
      } else {
        const output = await executeGitFlowCommand("bugfix list", [], { showOutput: false });
        const bugfixes = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
        const selectedBugfix = await showBranchSelection(bugfixes, "Select bugfix to finish");
        if (selectedBugfix) {
          await executeGitFlowCommand("bugfix finish", [selectedBugfix]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to finish bugfix: ${error}`);
    }
  });
  const bugfixListCommand = vscode.commands.registerCommand("git-flow-next.bugfix.list", async () => {
    await executeGitFlowCommand("bugfix list");
  });
  const bugfixCheckoutCommand = vscode.commands.registerCommand("git-flow-next.bugfix.checkout", async () => {
    try {
      const output = await executeGitFlowCommand("bugfix list", [], { showOutput: false });
      const bugfixes = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedBugfix = await showBranchSelection(bugfixes, "Select bugfix to checkout");
      if (selectedBugfix) {
        await executeGitFlowCommand("bugfix checkout", [selectedBugfix]);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to checkout bugfix: ${error}`);
    }
  });
  const bugfixDeleteCommand = vscode.commands.registerCommand("git-flow-next.bugfix.delete", async () => {
    try {
      const output = await executeGitFlowCommand("bugfix list", [], { showOutput: false });
      const bugfixes = output.split("\n").filter((line) => line.trim()).map((line) => line.trim());
      const selectedBugfix = await showBranchSelection(bugfixes, "Select bugfix to delete");
      if (selectedBugfix) {
        const confirmed = await vscode.window.showWarningMessage(
          `Are you sure you want to delete bugfix "${selectedBugfix}"?`,
          "Yes",
          "No"
        );
        if (confirmed === "Yes") {
          await executeGitFlowCommand("bugfix delete", [selectedBugfix]);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete bugfix: ${error}`);
    }
  });
  const bugfixRenameCommand = vscode.commands.registerCommand("git-flow-next.bugfix.rename", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "bugfix") {
        const newName = await promptForInput("Enter new bugfix name", branchInfo.name);
        if (newName) {
          await executeGitFlowCommand("bugfix rename", [newName]);
        }
      } else {
        vscode.window.showWarningMessage("You must be on a bugfix branch to rename it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename bugfix: ${error}`);
    }
  });
  const bugfixUpdateCommand = vscode.commands.registerCommand("git-flow-next.bugfix.update", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type === "bugfix") {
        await executeGitFlowCommand("bugfix update", [branchInfo.name]);
      } else {
        vscode.window.showWarningMessage("You must be on a bugfix branch to update it");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update bugfix: ${error}`);
    }
  });
  const shorthandFinishCommand = vscode.commands.registerCommand("git-flow-next.shorthand.finish", async () => {
    try {
      await executeGitFlowCommand("finish");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to finish current branch: ${error}`);
    }
  });
  const shorthandDeleteCommand = vscode.commands.registerCommand("git-flow-next.shorthand.delete", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type !== "unknown" && branchInfo.type !== "main" && branchInfo.type !== "develop") {
        const confirmed = await vscode.window.showWarningMessage(
          `Are you sure you want to delete "${branchInfo.fullName}"?`,
          "Yes",
          "No"
        );
        if (confirmed === "Yes") {
          await executeGitFlowCommand("delete");
        }
      } else {
        vscode.window.showWarningMessage("Cannot delete main/develop or unknown branch");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete current branch: ${error}`);
    }
  });
  const shorthandRebaseCommand = vscode.commands.registerCommand("git-flow-next.shorthand.rebase", async () => {
    try {
      await executeGitFlowCommand("rebase");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rebase current branch: ${error}`);
    }
  });
  const shorthandUpdateCommand = vscode.commands.registerCommand("git-flow-next.shorthand.update", async () => {
    try {
      await executeGitFlowCommand("update");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update current branch: ${error}`);
    }
  });
  const shorthandRenameCommand = vscode.commands.registerCommand("git-flow-next.shorthand.rename", async () => {
    try {
      const branchInfo = await getCurrentBranch();
      if (branchInfo.type !== "unknown" && branchInfo.type !== "main" && branchInfo.type !== "develop") {
        const newName = await promptForInput("Enter new branch name", branchInfo.name);
        if (newName) {
          await executeGitFlowCommand("rename", [newName]);
        }
      } else {
        vscode.window.showWarningMessage("Cannot rename main/develop or unknown branch");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to rename current branch: ${error}`);
    }
  });
  const shorthandPublishCommand = vscode.commands.registerCommand("git-flow-next.shorthand.publish", async () => {
    try {
      await executeGitFlowCommand("publish");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to publish current branch: ${error}`);
    }
  });
  const overviewCommand = vscode.commands.registerCommand("git-flow-next.overview", async () => {
    try {
      await executeGitFlowCommand("overview");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show overview: ${error}`);
    }
  });
  const configCommand = vscode.commands.registerCommand("git-flow-next.config", async () => {
    try {
      await executeGitFlowCommand("config");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show config: ${error}`);
    }
  });
  context.subscriptions.push(
    initCommand,
    featureStartCommand,
    featureFinishCommand,
    featureListCommand,
    featureCheckoutCommand,
    featureDeleteCommand,
    featureRenameCommand,
    featureUpdateCommand,
    releaseStartCommand,
    releaseFinishCommand,
    releaseListCommand,
    releaseCheckoutCommand,
    releaseDeleteCommand,
    releaseRenameCommand,
    releaseUpdateCommand,
    hotfixStartCommand,
    hotfixFinishCommand,
    hotfixListCommand,
    hotfixCheckoutCommand,
    hotfixDeleteCommand,
    hotfixRenameCommand,
    hotfixUpdateCommand,
    supportStartCommand,
    supportFinishCommand,
    supportListCommand,
    supportCheckoutCommand,
    supportDeleteCommand,
    supportRenameCommand,
    supportUpdateCommand,
    bugfixStartCommand,
    bugfixFinishCommand,
    bugfixListCommand,
    bugfixCheckoutCommand,
    bugfixDeleteCommand,
    bugfixRenameCommand,
    bugfixUpdateCommand,
    shorthandFinishCommand,
    shorthandDeleteCommand,
    shorthandRebaseCommand,
    shorthandUpdateCommand,
    shorthandRenameCommand,
    shorthandPublishCommand,
    overviewCommand,
    configCommand
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
