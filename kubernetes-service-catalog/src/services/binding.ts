import * as k8s from 'vscode-kubernetes-tools-api';
import * as vscode from 'vscode';

import { removeServiceBinding, writeServiceSecretData, writeServiceCatalogSecretData, bindingExists, writeUsageToClipboard, loadChartValues } from './util';
import * as shell from '../utils/shell';

export enum ServiceType {
    serviceEnv = "serviceEnv",
    serviceCatalogEnv = "serviceCatalogEnv"
}

interface ServiceReference {
    name: string;
    namespace: string;
}

export interface ServiceInstance {
    name: string;
    namespace: string;
    class: string;
    plan: string;
    status: string;
}

interface ServiceInstanceMap {
    [name: string]: ServiceInstance;
}

export const CACHED_SERVICE_INSTANCE_NAMES: string[] = [];
export const CACHED_SERVICE_INSTANCE_LIST: ServiceInstance[] = [];
export const CACHED_SERVICE_INSTANCES: ServiceInstanceMap = {};

let kubectlAPI: k8s.API<k8s.KubectlV1> | undefined = undefined;

async function invokeKubectl(command: string): Promise<k8s.KubectlV1.ShellResult | undefined> {
    if (!kubectlAPI) {
        kubectlAPI = await k8s.extension.kubectl.v1;
    }
    if (kubectlAPI.available) {
        return await kubectlAPI.api.invokeCommand(command);
    }
    throw new Error(`Can't get Kubectl API: ${kubectlAPI.reason}`);
}

export async function addService() {
    const chartYaml = await loadChartValues();

    const serviceResult = await invokeKubectl('get svc -o json');
    if (!serviceResult || serviceResult.code !== 0) {
        return;
    }

    const servicesJson = JSON.parse(serviceResult.stdout);
    if (servicesJson.items.length === 0) {
        vscode.window.showInformationMessage("No services found in current namespace");
        return;
    }

    const services: ServiceReference[] = servicesJson.items.map((i: any) => ({ name: i.metadata.name, namespace: i.metadata.namespace }));
    const serviceNames: string[] = services.map((s) => s.name);

    const selectedService = await vscode.window.showQuickPick(
        serviceNames,
        { placeHolder: "Select a Kubernetes service to bind" }
    );

    if (!selectedService) {
        return;
    }

    // filter on the name.
    const serviceObj = services.filter((service) => { return service.name === selectedService; })[0];
    const dnsName = `${serviceObj.name}.${serviceObj.namespace}.svc.cluster.local`;

    if (bindingExists(ServiceType.serviceEnv, serviceObj.name, chartYaml.yaml)) {
        return;
    }

    await writeServiceSecretData(serviceObj.name, dnsName, chartYaml);
    await writeUsageToClipboard(ServiceType.serviceEnv, serviceObj.name, [serviceObj.name]);
    vscode.window.showInformationMessage("Wrote service info to your clipboard");
}

export async function removeService() {
    await removeServiceBinding(ServiceType.serviceEnv);
}

/**
 * Creates a binding for the application to the selected service.
 * Modifies the values.yaml file to retain information about available environment variables.
 * Drops an information blurb on the clipboard for service catalog usage information.
 */
export async function addExternalService(): Promise<void> {
    const chartYaml = await loadChartValues();

    if (CACHED_SERVICE_INSTANCE_NAMES.length === 0 && Object.keys(CACHED_SERVICE_INSTANCES).length === 0) {
        await getServiceInstances();
    }

    const serviceToBind = await vscode.window.showQuickPick(CACHED_SERVICE_INSTANCE_NAMES, {
        placeHolder: "Pick an External Service to add to the selected application",
    });

    if (!serviceToBind) {
        return;
    }

    const binding = await createOrGetServiceBinding(serviceToBind);
    // could not create a new or get a service binding - not a case we should encounter.
    if (!binding) {
        return;
    }

    // check to see if we've already added this service binding.
    if (bindingExists(ServiceType.serviceCatalogEnv, binding, chartYaml.yaml)) {
        return;
    }

    const secretData = await getSecretData(binding);
    if (!secretData) {
        return;
    }
    const secretKeys = Object.keys(secretData);
    await writeServiceCatalogSecretData(binding, secretKeys, chartYaml);
    await writeUsageToClipboard(ServiceType.serviceCatalogEnv, binding, secretKeys);

    vscode.window.showInformationMessage(`Bound the application to External Service "${serviceToBind}"`);
}

/**
 * Removes a binding from the values.yaml file. Does not delete the binding from the service catalog
 * due to concerns about other applications having bound it.
 */
export async function removeExternalService () {
    await removeServiceBinding(ServiceType.serviceCatalogEnv);
}

/**
 * Retrieves deployed secrets.
 * @param secretName The secret name deployed by service catalog.
 * @returns The secret data
 */
async function getSecretData(secretName: string): Promise<{} | undefined> {
    try {
        const secretResults = await invokeKubectl(`get secret ${secretName} -o json`);

        if (!secretResults || secretResults.code !== 0) {
            vscode.window.showErrorMessage(`Could not get external service secret ${secretName} from the cluster`);
            return undefined;
        }

        const secretResultsJson = JSON.parse(secretResults.stdout);
        return secretResultsJson.data;
    } catch (e) {
        vscode.window.showErrorMessage(`Could not get external service secret ${secretName} from the cluster`);
        return;
    }
}

/**
 * Binds an external service by creating a secret containing consumable binding information.
 * @param serviceName The service to create a binding for.
 */
async function createOrGetServiceBinding(serviceName: string): Promise<string|null> {
    let results;
    try {
        results = await shell.exec(`svcat bind ${serviceName}`);
    } catch (e) {
        vscode.window.showErrorMessage(`Error binding to External Service "${serviceName}"`);
        return null;
    }

    if (results.code !== 0) {
        // binding exists - consume it.
        if (results.stderr.indexOf("already exists")) {
            return serviceName;
        }

        vscode.window.showErrorMessage(`Could not bind to External Service "${serviceName}"`);
        return null;
    }

    return serviceName;
}

/**
 * Gets available service instances deployed to your cluster.
 * @returns A list of ServiceInstance objects.
 */
export async function getServiceInstances(): Promise<ServiceInstance[] | undefined> {
    // If we've already got service instances, just return those.
    // TODO: figure out how we're gonna add new instances as they come up.
    if (CACHED_SERVICE_INSTANCE_NAMES.length !== 0 && Object.keys(CACHED_SERVICE_INSTANCES).length !== 0) {
        return CACHED_SERVICE_INSTANCE_LIST;
    }

    try {
        const results = await shell.exec(`svcat get instances`);

        if (results.code !== 0) {
            vscode.window.showErrorMessage(`Error retrieving Service Instances`);
            return undefined;
        }

        return parseServiceInstances(results.stdout);
    } catch (e) {
        vscode.window.showErrorMessage(`Error retrieving Service Instances`);
        return undefined;
    }
}

function parseServiceInstances(results: string): ServiceInstance[] {
    // Remove headers + empty lines.
    const splitResults = results.split('\n').slice(2).filter((s) => s.length !== 0);
    const serviceInstances = Array.of<ServiceInstance>();

    // Build up ServiceInstance objects.
    for (const line of splitResults) {
        const fields = line.split(' ').filter((s) => s.length !== 0);
        const serviceInstance = {
            name: fields[0],
            namespace: fields[1],
            class: fields[2],
            plan: fields[3],
            status: fields[4]
        };

        // Service instance name -> service instance map.
        CACHED_SERVICE_INSTANCES[serviceInstance.name] = serviceInstance;

        // All available service instance names.
        CACHED_SERVICE_INSTANCE_NAMES.push(serviceInstance.name);

        CACHED_SERVICE_INSTANCE_LIST.push(serviceInstance);
        serviceInstances.push(serviceInstance);
    }

    return serviceInstances;
}
