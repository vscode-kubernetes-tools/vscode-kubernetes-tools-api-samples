import * as k8s from 'vscode-kubernetes-tools-api';

export const KIND_CLUSTER_PROVIDER: k8s.ClusterProviderV1.ClusterProvider = {
    id: 'kind',
    displayName: 'Kind',
    supportedActions: ['create'],
    next: onNext
};

function onNext(wizard: k8s.ClusterProviderV1.Wizard, action: k8s.ClusterProviderV1.ClusterProviderAction, message: any): void {
    wizard.showPage("I am the Kind cluster provider");
}
