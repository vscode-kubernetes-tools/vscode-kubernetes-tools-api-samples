import * as k8s from 'vscode-kubernetes-tools-api';
import * as vscode from 'vscode';
import { KIND_CLUSTER_PROVIDER } from './kind-cluster-provider';

export async function activate(_context: vscode.ExtensionContext) {
    const cp = await k8s.extension.clusterProvider.v1;
    if (!cp.available) {
        vscode.window.showErrorMessage("Can't register Kind cluster provider: " + cp.reason);
        return;
    }

    cp.api.register(KIND_CLUSTER_PROVIDER);
}
