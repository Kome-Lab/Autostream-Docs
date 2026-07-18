# OAuthとDrive保存先

Integrations は、OAuth provider、OAuth connected account、Google Drive destination を管理する画面です。Google Drive upload の保存先はArchive画面で作成し、録画プロファイルから参照します。

## 3つの部品

| 部品 | 何を表すか | 使う先 |
| --- | --- | --- |
| OAuth Provider | Google / GitHub / Discord などの OAuth アプリ設定 | Control Panel login |
| OAuth Connected Account | 実際に接続したユーザーまたは運用アカウント | YouTube Live API、Google Drive upload |
| Google Drive Destination | 保存先 folder、共有ドライブ、base path | 録画プロファイル、Encoder Recorder |

OAuth Provider は「アプリの設定」、OAuth Connected Account は「そのアプリで接続したアカウント」、Drive Destination は「保存先」です。

## OAuth Provider

### 入力項目

| 項目 | 説明 | 注意 |
| --- | --- | --- |
| Existing provider | 編集対象 | 空欄なら新規 |
| Provider type | Google / GitHub / Discord | Control Panel login に使います |
| Name | 画面上の名前 | 用途が分かる名前にします |
| Client ID | OAuth アプリの client ID | provider から発行された値 |
| Client secret | OAuth アプリの secret | 保存後は表示されません |
| Redirect URI | `/auth/oauth/callback` | Control Panelに保存するprovider callbackです |
| Login scopes | provider種別ごとの固定値 | 手動入力しません |
| Allowed domains | login を許可する email domain | 空欄なら domain 制限なし |
| Enabled | provider を有効にする | off なら login / connection に使いません |
| Auto-provision first login | 初回 login でユーザーを自動作成 | default role が必要です |
| Default roles | 自動作成ユーザーへ付ける role | auto-provision on の時だけ選びます |

login provider に Drive / YouTube scope を混ぜません。Google Drive upload や YouTube Live API は、配信用の OAuth Connected Account をDrive保存先や YouTube Outputs で選びます。Google OAuth application 側には、Control Panel の OAuth Provider に保存する Redirect URI と同じ `/auth/oauth/callback` を登録します。ログイン、OAuth Connected Account、Drive / YouTube 接続はいずれもこの Redirect URI を使います。

## OAuth Connected Account

Connected Account は手入力ではなく、OAuth の callback で作成します。

### 作成手順

1. OAuth Provider を作成し、Enabled にします。
2. `Connect OAuth Connected Account` で provider を選びます。
3. `Label` に用途が分かる名前を入れます。
4. 接続用途を `YouTube Live・Drive保存`、`YouTube Liveのみ`、`Drive保存のみ` から選びます。
5. `Connect with OAuth` を押します。
6. provider 側の認可画面で許可します。
7. Control Panel に戻り、Connected Account 一覧の `利用可能な用途` が意図どおりか確認します。

`利用可能な用途` はGoogleから実際に許可されたscopeを基準に表示します。YouTube OutputsではYouTube Liveを利用できるaccountだけ、Drive DestinationではDrive保存を利用できるaccountだけが選択肢に出ます。両方を許可したaccountは両方の画面で選択できます。

### 変更できるもの

Connected Account の refresh token、subject、利用可能な用途は手入力で変更できません。画面から変更できるのは label だけです。用途を変更したい場合や認可し直したい場合は、削除して必要な接続用途で再接続します。

## Google Drive Destination

Drive Destination は、Archive Settings が参照する保存先です。

### 入力項目

| 項目 | 説明 | 注意 |
| --- | --- | --- |
| Existing destination | 編集対象 | 空欄なら新規 |
| Name | 保存先名 | Streams や Archive Settings で判断しやすい名前 |
| OAuth account | 保存に使うDrive対応のconnected account | Drive保存先の作成時に選びます |
| Folder ID | Google Drive folder ID | 保存後は表示されません |
| Base path | folder 内で使うベースパス | `AutoStream` など |
| Shared drive folder | 共有ドライブ配下か | 共有ドライブなら on |

### 作成手順

1. Google Drive に保存先 folder を作ります。
2. 共有ドライブなら、運用アカウントに必要な権限を付けます。
3. Control Panel の OAuth Connected Account を作ります。Drive Destination はこの接続アカウントを使う OAuth 固定です。
4. Google Drive Destination を開きます。
5. Archive画面で、接続アカウント、Folder ID、共有ドライブ設定を持つDrive保存先を作ります。
6. その保存先を使う録画プロファイルを作ります。
7. Streams の配信枠作成時に録画プロファイルを選びます。

## Archive Settingsとの関係

Drive Destination を作っただけでは upload は有効になりません。録画プロファイルで保存先とupload有無を設定し、そのプロファイルを配信枠へ割り当てます。

1. Archive画面でDrive保存先を作成します。
2. 録画形式、保持日数、upload有無、Drive保存先を設定した録画プロファイルを作成します。
3. Streams で配信枠を作成し、その録画プロファイルを選びます。
4. 作成後、ArchiveのDrive保存先一覧で configured / masked 状態を確認します。

## よくあるトラブル

| 状況 | 確認する場所 |
| --- | --- |
| OAuth authorization URL が返らない | Provider の client ID、secret、Control Panel public URL |
| callback 後に account が増えない | Google OAuth application にControl Panelへ保存したRedirect URIが完全一致で登録されているか、Control Panel public URL、承認したscope |
| Drive folder が missing | Destination の Folder ID を再保存 |
| upload が forbidden | Drive folder の共有権限、OAuth account、Shared drive 設定 |
| 録画プロファイルでDrive保存先を選べない | Connected Accountの利用可能な用途、Drive scope、Folder ID、共有ドライブ設定 |

## 削除するときの注意

| 削除対象 | 影響 |
| --- | --- |
| OAuth Provider | 新規 login / account 接続に使えなくなります |
| OAuth Connected Account | YouTube Live API や Drive upload に使えなくなります |
| Drive Destination | Streams の配信枠または Archive Settings が参照中なら削除は拒否されます |

削除前に、YouTube Outputs、Streams の配信枠、Archive Settings で使っていないか確認してください。Control Panel は参照中の Drive Destination を削除せず、先に配信枠やArchive profileから別の保存先へ変更するよう促します。
