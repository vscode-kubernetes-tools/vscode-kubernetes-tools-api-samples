'use strict';

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('k8stop.top', showResourceUsage);
    context.subscriptions.push(disposable);
}

async function showResourceUsage(target?: any): Promise<void> {
    vscode.window.showInformationMessage(`Command TBC ${target}`);
}
