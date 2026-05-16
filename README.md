# learning-notebooklm-workflow セットアップ手順

learning-notebooklm-workflowは、NotebookLM用Markdown教材を生成し、PlaywrightでNotebookLMのWeb UIを操作してノート作成・ソースアップロードを行います。

このスキルではNotebookLM自動化にPlaywrightが必須です。

## 前提

- Node.js 20以上
- npm
- Googleアカウント
- 通常のGoogle Chrome
- Linux環境ではChrome実行用のOS依存パッケージ

## 1. Node.jsとnpmを確認する

```bash
node --version
npm --version
```

Node.jsが未導入、または古い場合はNode.js 20以上を導入してください。推奨はVolta、nvm、または公式インストーラです。

## 2. package.jsonを作成する

初回のみ実行します。

```bash
npm init -y
```

## 3. Playwrightを導入する

```bash
npm install -D playwright
```

## 4. Chromeを導入する

NotebookLMのGoogleログインでは、Playwright同梱Chromiumが「安全でないブラウザ」と判定されることがあります。そのため、このワークフローでは通常のGoogle Chromeを使います。

```bash
npx playwright install chrome
```

## 5. LinuxのOS依存パッケージを導入する

```bash
npx playwright install-deps chrome
```

このコマンドはsudoを使うため、管理者権限が必要です。パスワード入力を求められた場合は、端末上で入力してください。

## 6. Playwrightの動作確認

```bash
node -e "import('playwright').then(() => console.log('playwright ok'))"
```

次のように表示されればPlaywright本体は利用できます。

```text
playwright ok
```

Chrome起動も確認する場合:

```bash
npx playwright open --channel chrome https://notebooklm.google.com/
```

NotebookLMが開けば、ブラウザ実行環境は準備済みです。

Googleログインが必要な場合は、開いたChrome上でログインを完了してください。

### Playwrightプロファイルのセキュリティ上の扱い

`--user-data-dir` で指定する `.notebooklm-playwright-profile` は、NotebookLM自動化専用のChromeプロファイルです。通常利用しているChromeプロファイルを直接使わず、専用プロファイルに分離することで、普段のブラウザ履歴、Cookie、拡張機能、保存データへ自動化が触れる範囲を抑えます。

一方で、このディレクトリにはGoogleログイン状態を再利用するためのCookie、Local Storage、履歴、キャッシュなどが保存される可能性があります。ローカル生成物ですが機密情報に近い扱いにしてください。

- Gitにコミットしないでください。`.gitignore` に `.notebooklm-playwright-profile/` を追加してください。
- 共有ディレクトリ、クラウド同期ディレクトリ、CI環境、他人に渡す作業フォルダには置かないでください。
- 不要になった場合は削除して構いません。削除すると次回実行時にGoogleログインをやり直す可能性があります。
- より安全に運用する場合は、リポジトリ配下ではなく `~/.cache/notebooklm-playwright-profile` などGit管理外の場所を `--user-data-dir` に指定してください。

NotebookLM画面での標準操作フローは次の通りです。

1. https://notebooklm.google.com/ にアクセスする。
2. `新規作成` ボタンを押す。
3. `ファイルをアップロード` を押す。
4. 生成済みMarkdownファイルを選択する。
5. `sources.md` にあるURLをURL/ウェブサイトソースとして追加する。

## 7. Googleログインが拒否される場合

通常Chromeでも、Playwrightから起動したブラウザでGoogleログインが拒否されることがあります。

```text
Couldn't sign you in
This browser or app may not be secure.
```

この場合は、同じ `--user-data-dir` を通常Chromeで直接開き、先にログイン済みプロファイルを作ってから再実行します。

```bash
/usr/bin/google-chrome \
  --user-data-dir=/home/user/projects/create-notebooklm/.notebooklm-playwright-profile \
  https://notebooklm.google.com/
```

ログイン後、NotebookLMのトップ画面まで入れたことを確認し、Chromeを閉じてからアップロードスクリプトを再実行してください。

## よくあるエラー

### `Playwrightがインストールされていません`

次を実行してください。

```bash
npm install -D playwright
```

### `Executable doesn't exist` またはChromeが見つからない

次を実行してください。

```bash
npx playwright install chrome
```

### `libnspr4.so: cannot open shared object file`

ChromeのOS依存パッケージが不足しています。

```bash
npx playwright install-deps chrome
```

sudoが使えない環境では、管理者に依存パッケージの導入を依頼するか、Chromeが動作する別環境で自動化を実行してください。

### NotebookLMの画面で止まる

NotebookLMはWeb UIのため、ラベルや操作フローが変わることがあります。ログイン、2要素認証、ノート作成、ファイルアップロードで止まった場合は、表示中のブラウザで操作を完了してからターミナルでEnterを押してください。

NotebookLMはSPAのため、画面表示直後に `新規作成` ボタンがまだ描画されていないことがあります。スクリプトは最大30秒待ってから `新規作成` / `ノートブックを新規作成` を探します。検出できない場合は `notebooklm-upload-result.md` の診断情報に候補ごとの検出数を記録します。

それでも止まった場合は、開いているブラウザで `新規作成` を押して新規ノートを作成し、ノート画面まで進んでからターミナルでEnterを押してください。アップロードで止まった場合は、`ファイルをアップロード` を押して対象ファイルを選択してからEnterを押してください。URLソース追加で止まった場合は、`notebooklm-upload-result.md` の `URLソース追加対象` に出ているURLをNotebookLMへ手動追加してからEnterを押してください。`クイズ` で止まった場合は、ブラウザで `クイズ` を押してからEnterを押してください。

## 手動フォールバック

自動化できない場合でも、生成済みMarkdownはそのままNotebookLMに投入できます。

1. https://notebooklm.google.com/ を開く。
2. `新規作成` を押して新規ノートを作成する。
3. `ファイルをアップロード` を押し、生成された `00_overview.md`、`01_core_concepts.md`、`02_deep_dive.md`、`03_sources.md`、`04_quiz_seed.md` をアップロードする。
4. `sources.md` に記載されたURLをURL/ウェブサイトソースとして追加する。
5. `notebooklm-prompt.md` の内容をNotebookLMのチャットに貼り付ける。
