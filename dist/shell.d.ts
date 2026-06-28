import { type SpawnSyncOptions } from "node:child_process";
export interface CommandResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}
export declare function runCommand(command: string, args?: string[], options?: SpawnSyncOptions): CommandResult;
export declare function runCommandOrThrow(command: string, args?: string[], options?: SpawnSyncOptions): CommandResult;
export declare function fileIsFresh(path: string, withinMinutes: number): boolean;
