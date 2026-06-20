# OAuthとDrive保存先

Integrations は、OAuth provider、OAuth connected account、Google Drive destination を管理する画面です。YouTube Live API、Google Drive upload、OAuth login を使う場合に必要です。

## 3つの部品

| 部品 | 何を表すか | 使う先 |
| --- | --- | --- |
| OAuth Provider | Google / GitHub / Discord などの OAuth アプリ設定 | login、Google account 接続 |
| OAuth Connected Account | 実際に接続したユーザーまたは運用アカウント | YouTube Live API、Google Drive upload |
| Google Drive Destination | 保存先 folder、共有ドライブ、base path | Archive Settings、Encoder Recorder |

OAuth Provider は「アプリの設定」、OAuth Connected Account は「そのアプリで接続したアカウント」、Drive Destination は「保存先」です。

## OAuth Provider

### 入力項目

| 項目 | 説明 | 注意 |
| --- | --- | --- |
| Existing provider | 編集対象 | 空欄なら新規 |
| Provider type | Google / GitHub / Discord | Google は Drive / YouTube にも使います |
| Name | 画面上の名前 | 用途が分かる名前にします |
| Client ID | OAuth アプリの client ID | provider から発行された値 |
| Client secret | OAuth アプリの secret | 保存後は表示されません |
| Redirect URI | callback URL | provider 側にも同じ値を登録します |
| Scopes | 要求する scope | カンマまたは改行で複数指定できます |
| Allowed domains | login を許可する email domain | 空欄なら domain 制限なし |
| Enabled | provider を有効にする | off なら login / connection に使いません |
| Auto-provision first login | 初回 login でユーザーを自動作成 | default role が必要です |
| Default roles | 自動作成ユーザーへ付ける role | auto-provision on の時だけ選びます |

### Google provider の用途

Google provider は用途により scope が変わります。

| 用途 | 必要な考え方 |
| --- | --- |
| Google login | email を確認できる scope を使います |
| Google Drive upload | Drive へ書き込める scope を含めます |
| YouTube Live API | YouTube Live を操作できる scope を含めます |

scope は provider 側の同意画面や審査にも関係します。必要以上に広くしないでください。

## OAuth Connected Account

Connected Account は手入力ではなく、OAuth の callback で作成します。

### 作成手順

1. OAuth Provider を作成し、Enabled にします。
2. `Connect OAuth Connected Account` で provider を選びます。
3. `Label` に用途が分かる名前を入れます。
4. `Connect with OAuth` を押します。
5. provider 側の認可画面で許可します。
6. Control Panel に戻り、Connected Account 一覧に出ることを確認します。

### 変更できるもの

Connected Account の refresh token や subject は手入力で変更できません。画面から変更できるのは label だけです。認可し直したい場合は、削除して再接続します。

## Google Drive Destination

Drive Destination は、Archive Settings が参照する保存先です。

### 入力項目

| 項目 | 説明 | 注意 |
| --- | --- | --- |
| Existing destination | 編集対象 | 空欄なら新規 |
| Name | 保存先名 | Streams や Archive Settings で判断しやすい名前 |
| Auth mode | OAuth connected account / Service Account | OAuth 方式が通常の運用に向きます |
| OAuth account | 保存に使う connected account | auth mode が OAuth の時に選びます |
| Folder ID | Google Drive folder ID | 保存後は表示されません |
| Base path | folder 内で使うベースパス | `AutoStream` など |
| Shared drive folder | 共有ドライブ配下か | 共有ドライブなら on |

### 作成手順

1. Google Drive に保存先 folder を作ります。
2. 共有ドライブなら、運用アカウントに必要な権限を付けます。
3. Control Panel の OAuth Connected Account を作ります。
4. Google Drive Destination を開きます。
5. `Auth mode` を選びます。
6. OAuth 方式なら OAuth account を選びます。
7. Folder ID と Base path を入れます。
8. 共有ドライブなら `Shared drive folder` を on にします。
9. 保存します。
10. Archive Settings でこの destination を選びます。

## Archive Settingsとの関係

Drive Destination を作っただけでは upload は有効になりません。

1. Archive Settings を開きます。
2. `Drive destination` で作成済み destination を選びます。
3. `Upload final archive` を on にします。
4. 初回は `Dry-run upload` を on のまま test stream で確認します。
5. upload 結果が問題なければ dry-run を off にします。

## よくあるトラブル

| 状況 | 確認する場所 |
| --- | --- |
| OAuth authorization URL が返らない | Provider の client ID、secret、redirect URI |
| callback 後に account が増えない | Provider の redirect URI、scope、Control Panel public URL |
| Drive folder が missing | Destination の Folder ID を再保存 |
| upload が forbidden | Drive folder の共有権限、OAuth account、Shared drive 設定 |
| Archive Settings で destination が出ない | Integrations の保存結果と画面 reload |

## 削除するときの注意

| 削除対象 | 影響 |
| --- | --- |
| OAuth Provider | 新規 login / account 接続に使えなくなります |
| OAuth Connected Account | YouTube Live API や Drive upload に使えなくなります |
| Drive Destination | Archive Settings が参照できなくなります |

削除前に、YouTube Outputs と Archive Settings で使っていないか確認してください。
