export default {
  title: 'AutoStream Docs',
  description: 'AutoStreamを初めて使う人向けの分かりやすい公開ドキュメントです。',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]],
  vite: {
    server: { host: '127.0.0.1', fs: { strict: true } },
    preview: { host: '127.0.0.1' },
  },
  themeConfig: {
    nav: [
      { text: 'はじめに', link: '/' },
      { text: 'インストール', link: '/runbooks/first-install' },
      { text: 'Control Panel', link: '/control-panel/' },
      { text: 'サービス導入', link: '/services/host-operations' },
      { text: 'サービス構成', link: '/overview/service-roles' },
      { text: '困ったとき', link: '/troubleshooting/' },
    ],
    sidebar: [
      {
        text: 'まず読む',
        items: [
          { text: 'AutoStreamとは', link: '/overview/what-is-autostream' },
          { text: 'サービス構成', link: '/overview/service-roles' },
          { text: '最初のインストール', link: '/runbooks/first-install' },
          { text: '初回管理者を作る', link: '/runbooks/create-first-admin' },
          { text: '最初の配信を始める', link: '/runbooks/start-first-stream' },
        ],
      },
      {
        text: 'Control Panel利用方法',
        items: [
          { text: '画面の全体像', link: '/control-panel/' },
          { text: 'ダッシュボード', link: '/control-panel/dashboard' },
          { text: '配信画面', link: '/control-panel/streams' },
          { text: 'プロファイル設定', link: '/control-panel/profiles' },
          { text: 'DiscordとYouTube', link: '/control-panel/discord-youtube' },
          { text: 'OAuthとDrive保存先', link: '/control-panel/integrations-drive' },
          { text: 'サービス割り当て', link: '/control-panel/services-workers' },
          { text: 'ユーザーとセキュリティ', link: '/control-panel/users-roles-security' },
          { text: '監視と通知', link: '/control-panel/observability' },
          { text: '監査ログとAPIトークン', link: '/control-panel/audit-tokens' },
        ],
      },
      {
        text: 'デプロイ',
        items: [
          { text: 'Dockerで動かす', link: '/deployment/docker' },
          { text: 'Linuxホストで直接動かす', link: '/deployment/host' },
          { text: 'HTTPSとreverse proxy', link: '/deployment/reverse-proxy' },
        ],
      },
      {
        text: '設定',
        items: [
          { text: '設定項目', link: '/configuration/environment-variables' },
          { text: '外部連携の設定', link: '/configuration/provider-integrations' },
          { text: '録画と保存先の設定', link: '/configuration/archive-storage' },
        ],
      },
      {
        text: 'サービス別',
        items: [
          { text: 'Control Panel', link: '/services/control-panel' },
          { text: 'Discord Bot', link: '/services/discord-bot' },
          { text: 'Worker', link: '/services/worker' },
          { text: 'Encoder Recorder', link: '/services/encoder-recorder' },
          { text: 'Observability', link: '/services/observability' },
        ],
      },
      {
        text: 'サービス導入・運用',
        items: [
          { text: '共通の導入と運用', link: '/services/host-operations' },
          { text: 'Control Panelを導入する', link: '/services/control-panel-install' },
          { text: 'Discord Botを導入する', link: '/services/discord-bot-install' },
          { text: 'Workerを導入する', link: '/services/worker-install' },
          { text: 'Encoder Recorderを導入する', link: '/services/encoder-recorder-install' },
          { text: 'Observabilityを導入する', link: '/services/observability-install' },
        ],
      },
      {
        text: '日常の使い方',
        items: [
          { text: '配信を開始・停止する', link: '/operations/start-stop-stream' },
          { text: '日常チェック', link: '/operations/daily-checklist' },
          { text: '録画と保存', link: '/operations/archive-flow' },
          { text: '状態を確認する', link: '/operations/monitoring' },
          { text: 'インシデントと通知', link: '/operations/incidents-notifications' },
          { text: 'バックアップと復元', link: '/operations/backup-restore' },
        ],
      },
      {
        text: '安全に使う',
        items: [
          { text: '安全に公開する', link: '/security/hardening' },
          { text: '秘密情報の扱い', link: '/security/secrets' },
          { text: '権限', link: '/security/roles-and-permissions' },
        ],
      },
      {
        text: '困ったとき',
        items: [
          { text: '困ったとき', link: '/troubleshooting/' },
          { text: '文字化けしたとき', link: '/troubleshooting/mojibake' },
          { text: 'ネットワークの確認', link: '/troubleshooting/network' },
        ],
      },
    ],
  },
};
