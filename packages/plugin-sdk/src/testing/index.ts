/**
 * Plugin Testing Utilities
 *
 * Import from "@kianax/plugin-sdk/testing"
 *
 * @example
 * ```typescript
 * import { PluginTester, mockContext } from '@kianax/plugin-sdk/testing';
 * import { myPlugin } from './myPlugin';
 *
 * const tester = new PluginTester(myPlugin);
 *
 * const result = await tester.execute({
 *   input: { query: "test" },
 *   config: { apiKey: "test-key" },
 *   credentials: { apiToken: "secret" }
 * });
 *
 * console.log('Result:', result);
 * ```
 */

export { PluginTester, mockContext } from "./PluginTester.js";
