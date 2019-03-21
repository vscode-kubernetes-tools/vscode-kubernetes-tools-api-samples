import * as k8s from 'vscode-kubernetes-tools-api';
import * as vscode from 'vscode';
import { addService, removeService, addExternalService, removeExternalService } from './services/binding';
import { ExternalServicesNodeContributor } from './explorer';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('svcat.addService', addService),
        vscode.commands.registerCommand('svcat.removeService', removeService),
        vscode.commands.registerCommand('svcat.addExternalService', addExternalService),
        vscode.commands.registerCommand('svcat.removeExternalService', removeExternalService),
    ];

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.registerNodeContributor(new ExternalServicesNodeContributor());
    }

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}
