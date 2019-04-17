import * as shelljs from 'shelljs';

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export function exec(cmd: string): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve) => {
        shelljs.exec(cmd, {}, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
    });
}
