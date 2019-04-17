import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

import * as svcat from './services/binding';

export class ExternalServicesNodeContributor implements k8s.ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'context';
    }
    async getChildren(_parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [new ExternalServicesFolderNode()];
    }
}

class ExternalServicesFolderNode implements k8s.ClusterExplorerV1.Node {
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const services = await svcat.getServiceInstances() || [];
        return services.map((service) => new ExternalServiceNode(service));
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('External Services', vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'svcat.folder';
        return treeItem;
    }
}

class ExternalServiceNode implements k8s.ClusterExplorerV1.Node{
    constructor(private readonly service: svcat.ServiceInstance) {}
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.service.name, vscode.TreeItemCollapsibleState.None);
        treeItem.contextValue = 'svcat.externalservice';
        return treeItem;
    }
}
