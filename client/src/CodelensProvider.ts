import * as vscode from 'vscode';
import url = require('url');

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private regex: RegExp;
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    this.regex = /Test that it should/g;

    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    this.codeLenses = [];
    const regex = new RegExp(this.regex);
    const text = document.getText();
    let matches: RegExpMatchArray;
    while ((matches = regex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(matches.index).line);
      const indexOf = line.text.indexOf(matches[0]);
      const position = new vscode.Position(line.lineNumber, indexOf);
      const range = document.getWordRangeAtPosition(position, new RegExp(this.regex));
      if (range) {
        this.codeLenses.push(
          new vscode.CodeLens(range, {
            title: 'Run Test',
            command: 'aartl-lang-server-client.codelensAction',
            arguments: [
              `-f "${url.fileURLToPath(document.uri.toString())}" -t "${line.text.replace('Test that it', '').trim()}"`,
            ],
          })
        );
      }
    }
    return this.codeLenses;
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
    return codeLens;
  }
}
