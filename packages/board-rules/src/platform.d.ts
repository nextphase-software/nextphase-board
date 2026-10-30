// SPDX-License-Identifier: Apache-2.0
// The only globals the board rules use beyond ES2022. Browsers, Workers and Node all provide them.
declare const crypto: { randomUUID(): `${string}-${string}-${string}-${string}-${string}` };
declare class TextEncoder { encode(input?: string): Uint8Array }
