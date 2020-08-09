# AARTL Language VSCode Extension

## Functionality

This Language Server works for aartl files. It has the following language features:

- Completions
- Diagnostics regenerated on each file change or configuration change
- Generating test rules based on actual responses
- Running tests

![VSCode Screenshot](https://raw.githubusercontent.com/Ivan-Kouznetsov/aartl-vscode-extension/master/vscodeScreenshot.png)

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```

## Building and installing

Within the directory for this project:

```
npm install -g vsce
vsce package
code --install-extension aartl-lang-server-VERSION.vsix
```

Replace VERSION with the current version.

## Debugging

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.

## Credits

Ice cream icon by [Dea Jae](https://www.iconfinder.com/deasigner_jae)
