import * as path from 'path';
import * as vscode from 'vscode';

export async function pickChart(): Promise<string | undefined> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("This command requires an open folder.");
        return;
    }
    const matches = await vscode.workspace.findFiles("**/Chart.yaml", "", 1024);

    switch (matches.length) {
        case 0:
            vscode.window.showErrorMessage("No charts found");
            return;
        case 1:
            // Assume that if there is only one chart, that's the one to run.
            const p = path.dirname(matches[0].fsPath);
            return p;
            return;
        default:
            const rootPath = vscode.workspace.rootPath;
            const toPath = (uri: vscode.Uri) => rootPath ? path.relative(rootPath, path.dirname(uri.fsPath)) || "." : uri.fsPath;
            const paths = matches.map(toPath);
            const selectedPath = await vscode.window.showQuickPick(paths);

            if (!selectedPath) {
                return undefined;
            }

            return rootPath ? path.join(rootPath, selectedPath) : selectedPath;
    }
}
