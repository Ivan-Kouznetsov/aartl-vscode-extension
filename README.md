# AARTL for Visual Studio Code

## Requirements

To use this extension you need to have the [AARTL test runner](https://github.com/Ivan-Kouznetsov/aartl/releases) on your machine.

## Functionality

An extension for Agnostic API Reliability Testing Language (AARTL) files. It has the following features:

- Code completion
- Diagnostics regenerated on each file change
- Generating test rules based on actual responses
- Generating test rules based on Open API (formerly Swagger) definitions
  - Select **AARTL: Create rules from Open API definitions** in command palette 
- Running tests

![VSCode Screenshot](https://raw.githubusercontent.com/Ivan-Kouznetsov/aartl-vscode-extension/master/vscodeScreenshot.png)

## Limitations

Generating test rules based on actual responses is only available for tests that have one request
