import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

const EOL = process.platform === 'win32' ? '\r\n' : '\n';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('k8stop.top', showResourceUsage);
    context.subscriptions.push(disposable);
}

async function showResourceUsage(target?: any): Promise<void> {
    const explorer = await k8s.extension.clusterExplorer.v1;
    if (!explorer.available) {
        vscode.window.showErrorMessage(`Command not available: ${explorer.reason}`);
        return;
    }
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        vscode.window.showErrorMessage(`kubectl not available: ${kubectl.reason}`);
        return;
    }

    const node = explorer.api.resolveCommandTarget(target);

    if (node && node.nodeType === 'resource') {
        const topCommand = composeTopCommand(node);
        if (topCommand) {
            const topResult = await kubectl.api.invokeCommand(topCommand);
            if (!topResult || topResult.code !== 0) {
                vscode.window.showErrorMessage(`Can't get resource usage: ${topResult ? topResult.stderr : 'unable to run kubectl'}`);
                return;
            }
            await showTopResult(topResult.stdout);
            return;
        }
    }

    vscode.window.showErrorMessage(`This command is available only on Kubernetes Node or Pod resources`);
}

function composeTopCommand(node: k8s.ClusterExplorerV1.ClusterExplorerResourceNode): string | undefined {
    if (node.resourceKind.manifestKind === 'Node') {
        const nodeName = node.name;
        return `top node ${nodeName}`;
    } else if (node.resourceKind.manifestKind === 'Pod') {
        const podName = node.name;
        const nsarg = node.namespace ? `--namespace=${node.namespace}` : '';
        return `top pod ${podName} ${nsarg}`;
    } else {
        return undefined;
    }
}

async function showTopResult(output: string): Promise<void> {
    const message = formatResourceUsage(output);
    await showTextAsDocument(message);
}
function formatResourceUsage(commandOutput: string) {
    // Format of output is:
    // NAME     FIELD1     FIELD2
    // abcde    fghij      lmnop
    const sourceLines = commandOutput.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const fieldNames = sourceLines[0].split(/\s+/).slice(1);
    const fieldValues = sourceLines[1].split(/\s+/).slice(1);
    const fieldIndexes = [...fieldNames.keys()];
    const messageLines = fieldIndexes.map((i) => `${fieldNames[i]}: ${fieldValues[i]}`);
    const message = messageLines.join(EOL);
    return message;
}

async function showTextAsDocument(text: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({ language: 'text', content: text });
    await vscode.window.showTextDocument(document);
}
