import * as vscode from 'vscode';
import url = require('url');
import * as parser from './test-writer/parser';
/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private regex: RegExp;
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  private isEndOfRequest = (line: string) => line.startsWith('To match JSON');

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
            command: 'aartl-lang-server-client.runAction',
            arguments: [
              `-f "${url.fileURLToPath(document.uri.toString())}" -t "${line.text.replace('Test that it', '').trim()}"`,
            ],
          })
        );
        try {
          // todo parse and do request
          const lines = [];
          let i = 0;
          for (i = document.positionAt(matches.index).line + 1; i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
            if (this.isEndOfRequest(document.lineAt(i).text)) break;
          }

          const reqs = parser.splitTestIntoSections(parser.preProcess(lines.join('\n'))).requests;
          if (reqs.length === 1) {
            this.codeLenses.push(
              new vscode.CodeLens(range, {
                title: 'Generate JSON Rules',
                command: 'aartl-lang-server-client.genAction',
                arguments: [{ req: reqs[reqs.length - 1], lineIndex: i }],
              })
            );
          }
        } catch {
          console.log("Can't find a request");
        }
      }
    }
    return this.codeLenses;
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
    return codeLens;
  }
}
