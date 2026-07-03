# HTTPSとreverse proxy

本番では Control Panel や各 service の public URL を HTTPS で公開します。直接 Go service をインターネットに出すのではなく、reverse proxy の後ろに置く構成を推奨します。

## 基本構成

1. Go service は `127.0.0.1` または内部 network で待ち受けます。
2. reverse proxy が HTTPS を終端します。
3. public URL は Control Panel と各 service の env に設定します。
4. firewall で不要な port を閉じます。

## 設定する値

| 値 | 例 | 用途 |
| --- | --- | --- |
| `AUTOSTREAM_PUBLIC_URL` | `https://control.example.com` | Control Panel の公開 URL |
| Node登録の Host / Port / SSL | `worker.example.com` / `443` / ON | Panel から各 Node Agent API へ到達する URL |
| trusted proxies | `127.0.0.1,10.0.0.0/8` | proxy 経由の client 情報 |
| allowed hosts | service host 名 | SSRF や誤接続の抑制 |

## 確認手順

1. HTTPS URL で Control Panel を開きます。
2. ログインできることを確認します。
3. Cookie が HTTPS 前提で動くことを確認します。
4. 各 service の heartbeat が届くことを確認します。
5. 外部から不要な port に接続できないことを確認します。

## よくある問題

- public URL が `http://` のままになっている
- reverse proxy の host header が service 側と合わない
- service は起動しているが firewall で遮断されている
- trusted proxy の設定が不足して client 情報が正しく扱えない
