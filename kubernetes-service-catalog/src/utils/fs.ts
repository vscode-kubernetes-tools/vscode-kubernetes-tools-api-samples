import * as sysfs from 'fs';
import { promisify } from 'util';

export const fs = {
    writeTextFile: promisify(
        (filename: string, data: string, callback: (err: NodeJS.ErrnoException) => void) => sysfs.writeFile(filename, data, callback)),

    unlinkAsync: promisify(
        (path: string, callback: (err: NodeJS.ErrnoException) => void) => sysfs.unlink(path, callback))
};
