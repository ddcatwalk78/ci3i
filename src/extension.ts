import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// 診断情報を管理するクラス
class CI3DiagnosticCollection {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codeigniter3');
    }

    // ファイルの診断を実行
    public analyzePHPFile(document: vscode.TextDocument) {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        
        // コントローラーの解析
        if (this.isController(document.fileName)) {
            this.analyzeController(text, diagnostics, document);
        }
        
        // モデルの解析
        if (this.isModel(document.fileName)) {
            this.analyzeModel(text, diagnostics, document);
        }

        // 診断結果を設定
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private isController(fileName: string): boolean {
        return fileName.includes('controllers') && fileName.endsWith('.php');
    }

    private isModel(fileName: string): boolean {
        return fileName.includes('models') && fileName.endsWith('.php');
    }

    private analyzeController(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        // コントローラーの基本クラス継承チェック
        if (!text.includes('extends CI_Controller')) {
            const range = this.findClassDeclarationRange(text, document);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Controller should extend CI_Controller',
                vscode.DiagnosticSeverity.Warning
            ));
        }

        // loadモデルの使用パターンチェック
        const modelLoadPattern = /\$this->load->model\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = modelLoadPattern.exec(text)) !== null) {
            const modelName = match[1];
            if (!this.validateModelExists(modelName)) {
                const pos = document.positionAt(match.index);
                const range = new vscode.Range(pos, pos.translate(0, match[0].length));
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Model '${modelName}' might not exist`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    }

    private analyzeModel(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        // モデルの基本クラス継承チェック
        if (!text.includes('extends CI_Model')) {
            const range = this.findClassDeclarationRange(text, document);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Model should extend CI_Model',
                vscode.DiagnosticSeverity.Warning
            ));
        }

        // データベースクエリの推奨パターンチェック
        const directQueryPattern = /\$this->db->query\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = directQueryPattern.exec(text)) !== null) {
            const pos = document.positionAt(match.index);
            const range = new vscode.Range(pos, pos.translate(0, match[0].length));
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Consider using Query Builder methods instead of direct queries for better security',
                vscode.DiagnosticSeverity.Information
            ));
        }
    }

    private findClassDeclarationRange(text: string, document: vscode.TextDocument): vscode.Range {
        const classPattern = /class\s+\w+/;
        const match = text.match(classPattern);
        if (match) {
            const pos = document.positionAt(match.index!);
            return new vscode.Range(pos, pos.translate(0, match[0].length));
        }
        return new vscode.Range(0, 0, 0, 0);
    }

    private validateModelExists(modelName: string): boolean {
        // TODO: プロジェクトのモデルディレクトリをスキャンして
        // モデルファイルの存在を確認する実装を追加
        return true;
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}

// 拡張機能のエントリーポイント
export function activate(context: vscode.ExtensionContext) {
    const analyzer = new CI3DiagnosticCollection();

    // ファイルが開かれたときの処理
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId === 'php') {
                analyzer.analyzePHPFile(document);
            }
        })
    );

    // ファイルが保存されたときの処理
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.languageId === 'php') {
                analyzer.analyzePHPFile(document);
            }
        })
    );

    // コマンドの登録
    context.subscriptions.push(
        vscode.commands.registerCommand('codeigniter-3-intelligence.analyzeCurrentFile', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'php') {
                analyzer.analyzePHPFile(editor.document);
            }
        })
    );
}

export function deactivate() {}
