import * as k8s from 'vscode-kubernetes-tools-api';

const KIND_CLUSTER_PROVIDER_ID = 'kind';

export const KIND_CLUSTER_PROVIDER: k8s.ClusterProviderV1.ClusterProvider = {
    id: KIND_CLUSTER_PROVIDER_ID,
    displayName: 'Kind',
    supportedActions: ['create'],
    next: onNext
};

const PAGE_SETTINGS = 'settings';
const PAGE_CREATE = 'create';

const SETTING_IMAGE_VERSION = 'imageversion';

function onNext(wizard: k8s.ClusterProviderV1.Wizard, _action: k8s.ClusterProviderV1.ClusterProviderAction, message: any): void {
    wizard.showPage("<h1>Please wait...</h1>");
    const sendingStep: string = message[k8s.ClusterProviderV1.SENDING_STEP_KEY];
    const htmlPromise = getPage(sendingStep, message);
    wizard.showPage(htmlPromise);
}

async function getPage(sendingStep: string, previousData: any): Promise<string> {
    switch (sendingStep) {
        case k8s.ClusterProviderV1.SELECT_CLUSTER_TYPE_STEP_ID:
            return collectSettings(previousData);
        case PAGE_SETTINGS:
            return await createCluster(previousData);
        default:
            return "Internal error";
    }
}

function collectSettings(previousData: any): string {
    const html = formPage(
        PAGE_SETTINGS,
        "Cluster Settings",
        `<p>Image version: <input type='text' name='${SETTING_IMAGE_VERSION}' value='latest' /></p>`,
        "Create",
        previousData);
    return html;
}

function createCluster(previousData: any): string {
    const html = formPage(
        PAGE_CREATE,
        "Cluster Created",
        `<p>Ha ha!  Not really.  But if I had it would be version ${previousData[SETTING_IMAGE_VERSION]}</p>`,
        null,
        previousData);
    return html;
}

function formPage(stepId: string, title: string, body: string, buttonCaption: string | null, previousData: any): string {
    const buttonHtml = buttonCaption ? `<button onclick='${k8s.ClusterProviderV1.NEXT_PAGE}'>${buttonCaption}</button>` : '';
    const previousDataFields = Object.keys(previousData)
                                     .filter((k) => k !== k8s.ClusterProviderV1.SENDING_STEP_KEY)
                                     .map((k) => `<input type='hidden' name='${k}' value='${previousData[k]}' />`)
                                     .join('\n');
    const html = `<h1>${title}</h1>
    <form id="${k8s.ClusterProviderV1.WIZARD_FORM_NAME}">
        <input type='hidden' name='${k8s.ClusterProviderV1.SENDING_STEP_KEY}' value='${stepId}' />
        ${previousDataFields}
        ${body}
        <p>${buttonHtml}</p>
    </form>
    `;

    return html;
}
