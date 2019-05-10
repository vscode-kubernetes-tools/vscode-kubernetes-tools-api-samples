import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import { after } from './sleep';

export async function activate(_context: vscode.ExtensionContext) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.registerNodeUICustomizer(new VersionSuffixer());
    }
}

export function deactivate() {
}

class VersionSuffixer implements k8s.ClusterExplorerV1.NodeUICustomizer {
    customize(node: k8s.ClusterExplorerV1.ClusterExplorerNode, treeItem: vscode.TreeItem): void | Thenable<void> {
        if (node.nodeType === 'context' || node.nodeType === 'context.inactive') {
            return this.customizeContextNode(node.name, treeItem);
        }
    }

    private async customizeContextNode(contextName: string, treeItem: vscode.TreeItem): Promise<void> {
        const serverVersion = await clusterVersion(contextName);
        if (serverVersion.length > 0) {
            treeItem.label = `${treeItem.label} [${serverVersion}]`;
        }
    }
}

async function clusterVersion(contextName: string): Promise<string> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return '';
    }

    const kubectlPromise = kubectl.api.invokeCommand(`version --output json --context ${contextName} --request-timeout=10s`);
    const timeoutPromise = after<'timedout'>(10000, 'timedout');  // --request-timeout doesn't help if kubectl blocks with an interactive auth prompt
    const sr = await Promise.race([kubectlPromise, timeoutPromise]);
    if (sr === 'timedout' || !sr || sr.code !== 0) {
        return '';
    }

    const versionInfo = JSON.parse(sr.stdout);
    const serverVersion = versionInfo.serverVersion;
    if (!serverVersion) {
        return '';
    }

    const major = serverVersion.major;
    const minor = serverVersion.minor;
    if (!major || !minor) {
        return '';
    }

    return `${major}.${minor}`;
}
