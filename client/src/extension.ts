import * as path from 'path';
import { ExtensionContext, languages, commands, Disposable, window, workspace } from 'vscode';
import { CodelensProvider } from './CodelensProvider';

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

let client: LanguageClient;
let disposables: Disposable[] = [];

export function activate(context: ExtensionContext) {
  // Code Lens

  const codelensProvider = new CodelensProvider();

  languages.registerCodeLensProvider({ scheme: 'file', language: 'aartl' }, codelensProvider);

  commands.registerCommand('aartl-lang-server-client.codelensAction', (arg: string) => {
    const pathToTestRunner = workspace.getConfiguration('aartlLangServer').get('pathToTestRunner');

    if (pathToTestRunner) {
      const term = window.createTerminal();
      term.sendText(`${pathToTestRunner} ${arg}`);
      term.show();
    } else {
      window.showErrorMessage(`Please set Path To Test Runner in settings`);
    }
  });

  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for aartl text documents
    documentSelector: [{ scheme: 'file', language: 'aartl' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc'),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient('aartlLangServer', 'Aartl Language Server', serverOptions, clientOptions);

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (disposables) {
    disposables.forEach((item) => item.dispose());
  }
  disposables = [];

  if (!client) {
    return undefined;
  }
  return client.stop();
}
