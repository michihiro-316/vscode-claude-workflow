/**
 * Hello World Example
 *
 * A simple example that demonstrates the basic structure
 * of a TypeScript file in the vscode-claude-workflow project.
 */

/**
 * Displays "Hello World" to the standard output.
 *
 * This function serves as a basic example of how to create
 * executable functions in this project.
 */
export function helloWorld(): void {
  console.log('Hello World');
}

/**
 * Main entry point when this file is executed directly.
 *
 * This allows the file to be run as a standalone script:
 * `ts-node src/examples/hello-world.ts`
 */
if (require.main === module) {
  helloWorld();
}
