import { Identifier } from "@babel/types";
import path = require("path");
import {
  languages,
  TextEditor,
  Uri,
  window,
  TextDocument,
  Range,
  workspace,
} from "vscode";
import {
  CssModuleExtensions,
  CSS_MODULE_EXTENSIONS,
  TS_MODULE_EXTENSIONS,
} from "../constants";
import { ParserResult } from "../parser/v2/tsx";
import * as fsg from "fast-glob";
import { CssParserResult, parseCss, Selector } from "../parser/v2/css";
import { promises as fs_promises } from "node:fs";
import Settings from "../settings";
import { ParserFactory } from "../parser/ParserFactory";
import { DiagnosticsProvider } from "../providers/ts/diagnostics";

type FileName = string;
type StyleIdentifier = Identifier["name"];
export type Selectors = {
  selectors: Map<
    StyleIdentifier,
    {
      uri: string;
      selectors: Map<string, Selector>;
      rangeAtEof: Range;
    }
  >;
};

// Full file path of the active opened file
type SourceFiles = Map<string, CssParserResult>;

type BootstrapParams = {
  initialBootup?: boolean;
  bootOnchange?: boolean;
  isDirty?: boolean;
  changedDocument?: TextDocument;
};

export type ParsedResult = Map<FileName, ParserResult & Selectors>;

export type TsConfig = {
  compilerOptions: {
    baseUrl: string;
  };
};

export type IgnoreDiagnostis = Map<
  string, // Selector
  Range // Range of the Selector
>;
export class Store {
  public parsedResult: ParsedResult = new Map();
  protected _sourceFiles: SourceFiles = new Map();
  /** Root path of the workspace */
  protected _workSpaceRoot: string | undefined;
  static diagonisticCollection =
    languages.createDiagnosticCollection("react-ts-css");
  protected diagnosticsProvider: DiagnosticsProvider | undefined;
  public ignoredDiagnostics: IgnoreDiagnostis = new Map();
  private tsConfig: TsConfig = {
    compilerOptions: {
      baseUrl: "",
    },
  };

  constructor() {
    const uri = window.activeTextEditor?.document?.uri;
    if (uri) {
      const _uri = workspace.getWorkspaceFolder(uri)?.uri;
      const workspaceRoot = _uri?.fsPath;
      this.workSpaceRoot = workspaceRoot;
    }
  }

  public get activeTextEditor(): TextEditor {
    const editor = window.activeTextEditor;
    if (!editor) {
      throw new Error("No Text editor found");
    }
    return editor;
  }

  public get workSpaceRoot(): string | undefined {
    return this._workSpaceRoot;
  }

  public set workSpaceRoot(v: string | undefined) {
    this._workSpaceRoot = v;
  }

  /**
   * Map of all the css/scss files in the workspace
   */
  public get sourceFiles(): SourceFiles {
    return this._sourceFiles;
  }

  private async saveTsConfig() {
    try {
      if (Settings.tsconfig) {
        const contents = (
          await fs_promises.readFile(
            path.resolve(this.workSpaceRoot ?? "", Settings.tsconfig)
          )
        ).toString();
        const tsconfig = JSON.parse(contents);
        this.tsConfig = tsconfig;
      } else {
        throw new Error("Unable to resolve tsconfig.json");
      }
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Adds one or more files to the map of source files
   * Called every time when a new file is created in the workspace
   * @param files readonly [Uri](#vscode.Uri)[]
   */
  public async addSourceFiles(files: readonly Uri[]) {
    files.forEach(async (f) => {
      if (
        CSS_MODULE_EXTENSIONS.includes(
          path.extname(f.fsPath) as CssModuleExtensions
        )
      ) {
        await this.storeCssParserResult(f.path);
      }
    });
  }

  public async storeCssParserResult(module: string) {
    try {
      const result = await parseCss(module);
      if (result) {
        this._sourceFiles.set(module, result);
      }
    } catch (e) {}
  }

  /**
   * Get the active opened text document
   * @returns [TextDocument](#vscode.TextDocument)
   */
  public getActiveTextDocument() {
    if (!this.activeTextEditor) {
      throw new Error("ActiveEditor not found inside storage");
    }
    return this.activeTextEditor.document;
  }

  public async bootStrap() {
    try {
      if (this.activeTextEditor.document.isDirty) {
        return;
      }
      if (!this.sourceFiles.size) {
        await this.setSourcefiles();
      }
      if (!this.tsConfig) {
        await this.saveTsConfig();
      }
      const filePath = this.activeTextEditor.document.uri.fsPath;
      const uri = this.activeTextEditor.document.uri;
      const workspaceRoot = workspace.getWorkspaceFolder(uri)?.uri.fsPath;
      const parserFactory = new ParserFactory({
        document: this.activeTextEditor.document,
        workspaceRoot,
        tsConfig: this.tsConfig,
        baseDir: Settings.baseDir,
        sourceFiles: this.sourceFiles,
      });
      const result = await parserFactory.parse();
      if (result) {
        this.parsedResult.set(filePath, {
          ...result.parsedResult,
          selectors: result.selectors,
        });
      }
      if (Settings.diagnostics) {
        return this.provideDiagnostics();
      }
    } catch (e) {}
  }

  /**
   * Set the source css files on activation
   * TODO: store only modules
   */
  private async setSourcefiles() {
    const uri = window.activeTextEditor?.document?.uri;
    if (uri) {
      const _uri = workspace.getWorkspaceFolder(uri)?.uri;
      const workspaceRoot = _uri?.fsPath;
      const glob = `**/*.{${CSS_MODULE_EXTENSIONS.map((e) =>
        e.replace(".", "")
      ).join(",")}}`;
      this.workSpaceRoot = workspaceRoot;
      const files = await fsg(glob, {
        cwd: workspaceRoot,
        ignore: ["node_modules", "build", "dist", "coverage"],
        absolute: true,
      });
      await Promise.all(
        files.map(async (v) => {
          await this.storeCssParserResult(v);
        })
      );
    }
  }

  /**
   *
   * @param offset number
   * @returns ParserResult['unsafe_identifiers'] | undefined
   */
  public getAccessorAtOffset(document: TextDocument, offset: number) {
    const node = this.parsedResult.get(document.fileName);
    if (node) {
      return node.style_accessors?.find(
        ({ property: n, object: o }) =>
          (n?.start! <= offset && offset <= n?.end!) ||
          (o?.start! <= offset && offset <= o?.end!)
      );
    }
    return undefined;
  }

  /**
   * Get all selectors for a given Identifier
   * @param identfier Identifier['name']
   * @returns Map<string,Selector>
   */
  public getSelectorsByIdentifier(identfier: Identifier["name"]) {
    const filePath = this.activeTextEditor.document.uri.fsPath;
    return this.parsedResult.get(filePath)?.selectors.get(identfier);
  }

  public getParsedResultByFilePath() {
    const filePath = this.activeTextEditor.document.uri.fsPath;
    return this.parsedResult.get(filePath);
  }

  /**
   * Flushes the entire storage on deactivation or opening a new workspace
   */
  public flushStorage() {
    this.workSpaceRoot = undefined;
    this._sourceFiles = new Map();
    this.parsedResult = new Map();
  }

  private provideDiagnostics() {
    const parsedResult = this.getParsedResultByFilePath();
    const activeFileDir = path.parse(
      this.activeTextEditor.document.uri.fsPath
    ).dir;
    const baseDir = this.tsConfig.compilerOptions.baseUrl || Settings.baseDir;
    const activeFileUri = this.activeTextEditor.document.uri;
    if (Settings.diagnostics) {
      this.diagnosticsProvider = new DiagnosticsProvider({
        parsedResult,
        activeFileDir,
        baseDir,
        activeFileUri,
      });
      this.diagnosticsProvider.runDiagnostics();
      this.diagnosticsProvider.provideDiagnostics();
      return this.diagnosticsProvider.getDiagnostics();
    }
  }

  /**
   *
   * @param args [Range, string] Range is range of source, second argument is the selector which should be ignored from diagnostic
   */
  public collectIgnoredDiagnostics([range, source]: [Range, string]) {
    this.ignoredDiagnostics.set(source, range);
    this.provideDiagnostics();
  }
}
export default new Store();