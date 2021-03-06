import fs from "fs-extra";
import _ from "lodash";
import path from "path";
import vscode from "vscode";
import { DENDRON_WS_NAME } from "../constants";
import { WorkspaceConfig } from "../settings";
import { VSCodeUtils, resolveTilde } from "../utils";
import { DendronWorkspace } from "../workspace";
import { BaseCommand } from "./base";

type CommandOpts = {
  rootDirRaw: string;
  skipOpenWs?: boolean;
};

type CommandInput = {
  rootDirRaw: string;
};

type CommandOutput = any;

export class SetupWorkspaceCommand extends BaseCommand<
  CommandOpts,
  CommandOutput,
  CommandInput
> {
  async gatherInputs(): Promise<CommandInput | undefined> {
    const rootDirRaw = await VSCodeUtils.gatherFolderPath({
      default: path.join(resolveTilde("~"), "Dendron"),
    });
    if (_.isUndefined(rootDirRaw)) {
      return;
    }
    return { rootDirRaw };
  }

  async execute(opts: CommandOpts) {
    const ctx = "SetupWorkspaceCommand extends BaseCommand";
    const ws = DendronWorkspace.instance();
    const { rootDirRaw: rootDir, skipOpenWs } = _.defaults(opts, {
      skipOpenWs: false,
    });
    ws.L.info({ ctx, rootDir, skipOpenWs });

    // handle existing
    if (fs.existsSync(rootDir)) {
      const options = {
        delete: { msg: "delete existing folder", alias: "d" },
        abort: { msg: "abort current operation", alias: "a" },
        continue: {
          msg: "initialize workspace into current folder",
          alias: "c",
        },
      };
      const resp = await vscode.window.showInputBox({
        prompt: `${rootDir} exists. Please specify the next action. Your options: ${_.map(
          options,
          (v, k) => {
            return `(${k}: ${v.msg})`;
          }
        ).join(", ")}`,
        ignoreFocusOut: true,
        value: "continue",
        validateInput: async (value: string) => {
          if (!_.includes(_.keys(options), value.toLowerCase())) {
            return `not valid input. valid inputs: ${_.keys(options).join(
              ", "
            )}`;
          }
          return null;
        },
      });
      if (resp === "abort") {
        vscode.window.showInformationMessage(
          "did not initialize dendron workspace"
        );
        return;
      } else if (resp === "delete") {
        try {
          fs.removeSync(rootDir);
        } catch (err) {
          ws.L.error(JSON.stringify(err));
          vscode.window.showErrorMessage(
            `error removing ${rootDir}. please check that it's not currently open`
          );
          return;
        }
        vscode.window.showInformationMessage(`removed ${rootDir}`);
      }
    }

    // make sure root dir exists
    fs.ensureDirSync(rootDir);
    const src = vscode.Uri.joinPath(ws.extensionAssetsDir, "notes");
    fs.copySync(src.fsPath, rootDir);
    WorkspaceConfig.write(rootDir);
    if (!opts.skipOpenWs) {
      vscode.window.showInformationMessage("opening dendron workspace");
      return VSCodeUtils.openWS(
        vscode.Uri.file(path.join(rootDir, DENDRON_WS_NAME)).fsPath
      );
    }
    return;
  }
}
