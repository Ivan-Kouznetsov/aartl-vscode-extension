import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Position,
  Range,
} from 'vscode-languageserver';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { aliasesedMatchers } from './rules';
import * as jsonpath from 'jsonpath';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

// Settings
interface LangServerSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in here
// but could happen with other clients.
const defaultSettings: LangServerSettings = { maxNumberOfProblems: 1000 };
let globalSettings: LangServerSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<LangServerSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <LangServerSettings>(change.settings.aartl || defaultSettings);
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<LangServerSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'aartl',
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

const isValidJsonPath = (path: string) => {
  try {
    jsonpath.value({}, path);
  } catch {
    return false;
  }
  return true;
};

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // Here we get the settings for every validate run.
  const settings = await getDocumentSettings(textDocument.uri);

  const documentText = textDocument.getText();

  const jsonPathPattern = /(?<=(Pass on){0,1}\s{0,}")[$\s\w.]*?(?="\s{0,}(:|as))/g;
  const emptyTitle = /Test that it should\s{0,}$/gm;

  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];

  // check for invalid json paths

  while ((m = jsonPathPattern.exec(documentText)) && problems < settings.maxNumberOfProblems) {
    if (!isValidJsonPath(m[0])) {
      problems++;
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(m.index),
          end: textDocument.positionAt(m.index + m[0].length),
        },
        message: `${m[0]} is not a valid JSON path`,
        source: 'aartl',
      });
    }
  }

  // check for empty paths

  while ((m = emptyTitle.exec(documentText)) && problems < settings.maxNumberOfProblems) {
    problems++;
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length),
      },
      message: `${m[0]} test has to have a title`,
      source: 'aartl',
    });
  }

  // check for redefined using values
  let inUsingValueBlock = false;
  let valueNameCounts: { [key: string]: boolean } = {};

  for (let i = 0; i < textDocument.lineCount; i++) {
    if (problems >= settings.maxNumberOfProblems) break;
    // https://github.com/Microsoft/vscode-languageserver-node/issues/146#issuecomment-356576587
    const currentLine = textDocument.getText(Range.create(i, -1, i, Number.MAX_VALUE));
    if (currentLine.trim() === 'Using values') {
      //start of using values
      inUsingValueBlock = true;
    } else if (!currentLine.includes(':') && currentLine.trim().length > 0) {
      inUsingValueBlock = false;
      valueNameCounts = {};
    } else if (inUsingValueBlock) {
      const valueNameMatch = /\S*?(?=\s{0,}:)/.exec(currentLine);
      if (valueNameMatch !== null) {
        const valueName = valueNameMatch[0];
        if (typeof valueNameCounts[valueName] === 'undefined') {
          valueNameCounts[valueName] = true;
        } else {
          // not unique

          problems++;
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: Position.create(i, currentLine.indexOf(valueName)),
              end: Position.create(i, currentLine.indexOf(':')),
            },
            message: `${valueName} is already defined, value names must be unique`,
            source: 'aartl',
          });
        }
      }
    }
  }

  // check for lines that are not in a block and non data lines
  let inABlock = false;
  let inBody = false;
  for (let i = 0; i < textDocument.lineCount; i++) {
    if (problems >= settings.maxNumberOfProblems) break;
    // https://github.com/Microsoft/vscode-languageserver-node/issues/146#issuecomment-356576587
    const currentLine = textDocument.getText(Range.create(i, -1, i, Number.MAX_VALUE)).trim();

    const testStart = 'Test that it should';
    const blocks = [
      'Using values',
      'After HTTP request',
      'Expect HTTP request',
      'To match header rules',
      'To match JSON rules',
    ];
    const keywords = ['Pass on', 'To respond with status code'];
    if (currentLine.startsWith(testStart)) {
      inABlock = false;
      inBody = false;
    } else if (blocks.find((b) => currentLine.startsWith(b))) {
      inABlock = true;
      inBody = false;
    } else if (!inABlock) {
      problems++;
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: Position.create(i, 0),
          end: Position.create(i, Number.MAX_VALUE),
        },
        message: `This is outside of any block, this will not be executed by the test runner`,
        source: 'aartl',
      });
    } else if (currentLine.startsWith('body:')) {
      inBody = true;
    } else if (currentLine.includes(':')) {
      inBody = false;
    } else if (
      blocks.find((b) => currentLine.startsWith(b)) === undefined &&
      keywords.find((k) => currentLine.startsWith(k)) === undefined &&
      !inBody &&
      currentLine.length > 0 &&
      !currentLine.startsWith('/**')
    ) {
      // not a data line and not keyword or any of the above
      problems++;
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: Position.create(i, 0),
          end: Position.create(i, Number.MAX_VALUE),
        },
        message: `Should be a keyword or data, this seems like neither`,
        source: 'aartl',
      });
    }
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

/**
 * Helpers for checking context
 */

const getLineUpToCursor = (_textDocumentPosition: TextDocumentPositionParams) => {
  const currentDocument = documents.get(_textDocumentPosition.textDocument.uri);
  if (currentDocument) {
    return currentDocument.getText({
      start: Position.create(_textDocumentPosition.position.line, 0),
      end: _textDocumentPosition.position,
    });
  }

  return '';
};

const isRule = (_textDocumentPosition: TextDocumentPositionParams): boolean => {
  const line = getLineUpToCursor(_textDocumentPosition);
  return /"\$.{0,}":\s/.test(line);
};

const isHeaderRule = (_textDocumentPosition: TextDocumentPositionParams): boolean => {
  const line = getLineUpToCursor(_textDocumentPosition);
  return /"[^$.]+":\s/.test(line);
};

const isMethod = (_textDocumentPosition: TextDocumentPositionParams): boolean => {
  const line = getLineUpToCursor(_textDocumentPosition);
  return line.includes('method:');
};

const isUrl = (_textDocumentPosition: TextDocumentPositionParams): boolean => {
  const line = getLineUpToCursor(_textDocumentPosition);
  return line.includes('url:');
};

const isWaitFor = (_textDocumentPosition: TextDocumentPositionParams): boolean => {
  const line = getLineUpToCursor(_textDocumentPosition);
  return line.includes('Wait for');
};

const isBlank = (_textDocumentPosition: TextDocumentPositionParams): boolean => {
  const line = getLineUpToCursor(_textDocumentPosition);

  return line.trim().length < 4;
};

// This handler provides the initial list of the completion items.
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  const methodKind = CompletionItemKind.Constant;
  const regularKind = CompletionItemKind.Function;
  const dataKind = CompletionItemKind.Variable;
  const ruleKind = CompletionItemKind.Method;
  const httpMethods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'];
  const headerRules = ['must not be present'];

  if (isMethod(_textDocumentPosition)) {
    return httpMethods.map((m) => ({ kind: methodKind, label: m }));
  } else if (isBlank(_textDocumentPosition)) {
    return [
      {
        label: 'Test that it should',
        kind: regularKind,
      },
      {
        label: 'Using values',
        kind: regularKind,
      },
      {
        label: 'After HTTP request',
        kind: regularKind,
      },
      {
        label: 'Expect HTTP request',
        kind: regularKind,
      },
      {
        label: 'method:',
        kind: dataKind,
      },
      {
        label: 'url:',
        kind: dataKind,
      },
      {
        label: 'body:',
        kind: dataKind,
      },
      {
        label: 'headers:',
        kind: dataKind,
      },
      {
        label: 'Pass on',
        kind: dataKind,
      },
      {
        label: 'Wait for',
        kind: regularKind,
      },
      {
        label: 'To respond with status code',
        kind: regularKind,
      },
      {
        label: 'To match JSON rules',
        kind: regularKind,
      },
      {
        label: 'To match header rules',
        kind: regularKind,
      },
    ];
  } else if (isUrl(_textDocumentPosition)) {
    return [
      {
        label: 'http://localhost',
        kind: CompletionItemKind.Text,
      },
    ];
  } else if (isWaitFor(_textDocumentPosition)) {
    return [
      {
        label: 'seconds',
        kind: CompletionItemKind.Unit,
      },
      {
        label: 'milliseconds',
        kind: CompletionItemKind.Unit,
      },
    ];
  } else if (isRule(_textDocumentPosition)) {
    return aliasesedMatchers.map((a) => ({ kind: ruleKind, label: a }));
  } else if (isHeaderRule(_textDocumentPosition)) {
    return headerRules.map((hr) => ({ kind: ruleKind, label: hr }));
  }
  return [];
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    if (item.label === 'Test that it should') {
      item.detail = 'Title of the test';
      item.documentation = 'Title of the test';
    }
    return item;
  }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
