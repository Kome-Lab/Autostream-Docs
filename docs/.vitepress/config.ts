export default {
  title: 'AutoStream Docs',
  description: 'AutoStreamを初めて使う人向けの分かりやすい公開ドキュメントです。',
  head: [ ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }] ],
  vite: { server: { host: '127.0.0.1', fs: { strict: true } }, preview: { host: '127.0.0.1' } },
  themeConfig: {
    nav: [ { text: 'はじめに', link: '/' }, { text: 'インストール', link: '/runbooks/first-install' }, { text: '困ったとき', link: '/troubleshooting/' } ],
    sidebar: [
      { text: 'まず読む', items: [ { text: 'AutoStreamとは', link: '/overview/what-is-autostream' }, { text: '最初のインストール', link: '/runbooks/first-install' }, { text: 'Dockerで動かす', link: '/deployment/docker' }, { text: 'Linuxホストで直接動かす', link: '/deployment/host' }, { text: '設定項目', link: '/configuration/environment-variables' }, { text: '初回管理者を作る', link: '/runbooks/create-first-admin' }, { text: '最初の配信を始める', link: '/runbooks/start-first-stream' } ] },
      { text: '日常の使い方', items: [ { text: '配信を開始・停止する', link: '/operations/start-stop-stream' }, { text: '日常チェック', link: '/operations/daily-checklist' }, { text: '録画と保存', link: '/operations/archive-flow' }, { text: '状態を確認する', link: '/operations/monitoring' }, { text: 'バックアップと復元', link: '/operations/backup-restore' } ] },
      { text: '安全に使う', items: [ { text: '安全に公開する', link: '/security/hardening' }, { text: '秘密情報の扱い', link: '/security/secrets' }, { text: '権限', link: '/security/roles-and-permissions' } ] },
      { text: '困ったとき', items: [ { text: '困ったとき', link: '/troubleshooting/' }, { text: '文字化けしたとき', link: '/troubleshooting/mojibake' }, { text: 'ネットワークの確認', link: '/troubleshooting/network' } ] }
    ],
  },
};
