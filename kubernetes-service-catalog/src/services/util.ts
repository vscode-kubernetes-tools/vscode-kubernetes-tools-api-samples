import * as vscode from 'vscode';
import * as yamljs from 'yamljs';

import { ServiceType } from './binding';
import { fs } from '../utils/fs';
import * as helm from '../utils/helm';

interface BindingBase {
    readonly name: string;
}

interface ServiceBinding extends BindingBase {
    readonly value: string;
}

interface ServiceCatalogBinding extends BindingBase {
    readonly vars: string[];
}

type BindingsType<T extends ServiceType> =
    T extends ServiceType.serviceEnv ? ServiceBinding[] : ServiceCatalogBinding[];

interface ChartYaml {
    path: string;
    yaml: {
        [ServiceType.serviceEnv]?: ServiceBinding[],
        [ServiceType.serviceCatalogEnv]?: ServiceCatalogBinding[],
    };
}

export async function writeServiceSecretData(
    bindingName: string,
    value: string,
    chartYaml: ChartYaml
) {
    const serviceBinding = {
        name: bindingName,
        value: value
    };

    if (chartYaml.yaml.serviceEnv) {
        chartYaml.yaml.serviceEnv.push(serviceBinding);
    } else {
        chartYaml.yaml.serviceEnv = [serviceBinding];
    }

    await rewriteFile(chartYaml);
}

export async function writeServiceCatalogSecretData(
    bindingName: string,
    value: string[],
    chartYaml: ChartYaml
) {
    const serviceCatalogBinding = {
        name: bindingName,
        vars: value
    };

    if (chartYaml.yaml.serviceCatalogEnv) {
        chartYaml.yaml.serviceCatalogEnv.push(serviceCatalogBinding);
    } else {
        chartYaml.yaml.serviceCatalogEnv = [serviceCatalogBinding];
    }

    await rewriteFile(chartYaml);
}

/**
 * Checks to see if we've already added a binding for a service.
 * @param serviceType
 * @param bindingName A binding name to check in valuesYaml.serviceCatalogEnv.
 * @param valuesYaml The loaded values.yaml file.
 * @returns A boolean indicating that the binding to be added is already in the values yaml.
 */
export function bindingExists(serviceType: ServiceType, bindingName: string, valuesYaml: any): boolean {
    const bindings: BindingBase[] | undefined = valuesYaml[serviceType];

    if (!bindings) {
        return false;
    }

    return bindings.some((binding) => {
        return binding.name === bindingName;
    });
}

/**
 * Writes usage information for the deployed service to the system clipboard.
 * @param serviceType the type of Service to write binding info for.
 * @param bindingName The name of the external service
 * @param secretKeys The keys to write usage information about.
 */
export async function writeUsageToClipboard(
    serviceType: ServiceType,
    bindingName: string,
    secretKeys: string[]
) {
    if (serviceType === ServiceType.serviceEnv) {
        const message = `// To use service ${bindingName}, we added an environment variable containing the DNS hostname: SERVICE_${bindingName.toUpperCase()}`;
        await vscode.env.clipboard.writeText(message);
        return;
    }

    vscode.window.showInformationMessage("Wrote Service Usage information to your clipboard.");

    const environmentVariableMessages = secretKeys.map((k) => `// ${bindingName}_${k}`.toUpperCase());

    const message = `// To use service ${bindingName}, we added a number of environment variables\n// to your application, as listed below:\n${environmentVariableMessages.join('\n')}`;

    await vscode.env.clipboard.writeText(message);
}

export async function loadChartValues(): Promise<ChartYaml> {
    const chartPath = await helm.pickChart();  // NOTE: currently aimed at Draft applications; for multi-chart projects should look at the command target URI
    const valuesFile = `${chartPath}/values.yaml`;
    const valuesYaml = yamljs.load(valuesFile);

    return {
        path: valuesFile,
        yaml: valuesYaml
    } as ChartYaml;
}

export async function removeServiceBinding<T extends ServiceType>(serviceType: T): Promise<void> {
    const chartYaml = await loadChartValues();
    const bindings: BindingBase[] | undefined = chartYaml.yaml[serviceType];

    if (!bindings || bindings.length === 0) {
        vscode.window.showInformationMessage("No Services to remove.");
        return;
    }

    const chartBindings = bindings.map((b) => b.name);

    const bindingToRemove = await vscode.window.showQuickPick(chartBindings, {
        placeHolder: "Select a Service to remove"
    });

    // No selection was made.
    if (!bindingToRemove) {
        return;
    }

    const prunedChartBindings = bindings.filter((binding) =>
        binding.name !== bindingToRemove
    );

    chartYaml.yaml[serviceType] = prunedChartBindings as BindingsType<T>;

    await rewriteFile(chartYaml);
}

async function rewriteFile(chartYaml: ChartYaml) {
    await fs.unlinkAsync(chartYaml.path);
    await fs.writeTextFile(chartYaml.path, yamljs.stringify(chartYaml.yaml, 2));
}
