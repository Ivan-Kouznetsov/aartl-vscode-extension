import * as path from 'path';
import { ExtensionContext, languages, commands, Disposable, window, workspace, Position } from 'vscode';
import { CodelensProvider } from './CodelensProvider';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import { IKeyValuePair } from './test-writer/interfaces/test';
import { request } from './http-promise';
import { traverseObject } from './test-writer/traverseObject';
import { ruleWriter } from './test-writer/ruleWriter';

let client: LanguageClient;
let disposables: Disposable[] = [];

export const keyValuePairArrayHashTable = (arr: IKeyValuePair[]): { [key: string]: string } => {
  const result: { [key: string]: string } = {};

  arr.forEach((item) => {
    const key = Object.keys(item)[0].toString();
    result[key] = item[key].toString();
  });
  return result;
};

export function activate(context: ExtensionContext) {
  // Code Lens
  const pathToTestRunner = workspace.getConfiguration('aartl').get('pathToTestRunner');
  const codelensProvider = new CodelensProvider();

  languages.registerCodeLensProvider({ scheme: 'file', language: 'aartl' }, codelensProvider);

  commands.registerCommand('aartl-lang-server-client.runAction', (arg: string) => {
    if (pathToTestRunner) {
      const term = window.createTerminal();
      term.sendText(`${pathToTestRunner} ${arg}`);
      term.show();
    } else {
      window.showErrorMessage(`Please set Path To Test Runner in settings`);
    }
  });

  commands.registerCommand('aartl-lang-server-client.genAction', async (args: any) => {
    window.showInformationMessage('Generating JSON rules');
    try {
      const { req, lineIndex } = args;

      const data = await request(req.url, req.method, keyValuePairArrayHashTable(req.headers), req.body, 10000);
      if (data.json) {
        const editor = window.activeTextEditor;
        const paths = traverseObject(data.json);
        const rules = ruleWriter(data.json, paths);
        const formattedRules = rules.map((r) => `\t"${Object.keys(r)[0]}": ${r[Object.keys(r)[0]]}`).join('\n');

        if (editor) {
          editor.edit((editBuilder) => {
            editBuilder.insert(new Position(lineIndex + 1, 0), formattedRules);
          });
        }
      } else {
        window.showErrorMessage('Request did not return JSON');
      }
    } catch (ex) {
      window.showErrorMessage('Could not generate JSON rules because ' + JSON.stringify(ex));
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
  client = new LanguageClient('aartl', 'Aartl Language Server', serverOptions, clientOptions);

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
