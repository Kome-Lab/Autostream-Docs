# Bridge release / fleet移行gate

このrunbookは、Slice 9の公開release、systemd / Docker canary、host単位の
`pull_v2`移行、bake、別releaseでのlegacy撤去を、1つずつ止めながら進めるための
記録gateです。CLIはinventory JSONの整合性だけを検証します。GitHub、Control
Panel、host、firewallへ接続せず、release、deploy、ownership切替、port変更、
legacy削除を実行しません。

実hostや公開releaseから得た証拠をoperatorがinventoryへ転記し、各phaseの
`PASS`を次の操作へ進む条件にします。全evidence欄は、repository外へ保存した
secret-free evidence bundleの`sha256:<64-hex>`だけを記録します。監査log ID、
公開run URL、照合手順はbundle内へ保存します。単なる`checked`、口頭確認、
同じinventory内の自己参照はproofとして使いません。

## Inventoryをrepository外へ置く

inventoryへcredentialを入れてはいけません。`token`、`secret`、`password`、
`credential`、`private_key`、`api_key`などのsecret値を表すkeyは、値を表示せず
fail closedで拒否されます。Host Agent identity、Runtime Token、Configure
Token、SSH private key、cookie、Authorization headerも保存しません。

CLIはinventoryのreal pathが`autostream-docs` repository内なら拒否します。
workspace直下の`.local-runtime/bridge-fleet/`など、repository外へ置きます。

```bash
install -d -m 0700 ../.local-runtime/bridge-fleet
install -m 0600 /dev/null \
  ../.local-runtime/bridge-fleet/change-example.json
```

Windowsでは同じ場所を使い、対象user以外のACLを外します。inventoryと証拠logは
commit、release asset、support ticketへ添付しません。

## CLI

`autostream-docs` repositoryで実行します。

```bash
npm run bridge:fleet-gate -- release \
  ../.local-runtime/bridge-fleet/change-example.json
```

phaseは次の順序で進めます。

1. `release`
2. `systemd-canary`
3. `docker-canary`
4. `fleet-non-control`
5. `fleet-control`
6. bake完了後の`legacy-removal`

成功時はinventory値やhost IDを出さず、固定形式のsummaryだけをstdoutへ出します。

```text
PASS phase=release hosts=3 migrated=0 systemd_canaries=0 docker_canaries=0
```

検証停止はexit `1`で、JSON pathと理由だけをstderrへ出します。usage、未知phase、
読めないfile、壊れたJSONはexit `2`です。同じinventoryとphaseは、同じ順序の
errorを返します。

## 最小inventory template

次は構造を埋めるための意図的に不合格なtemplateです。ID、version、commitは架空で、
全`0`のdigest / evidenceはplaceholderとしてCLIが拒否します。authoritative
Control Panel rosterに存在する全execution hostを省略せず列挙し、release matrixの
asset名、digest、attestationを実際の公開結果へ置き換えるまで`release`は実行しません。

<!-- bridge-fleet-gate-template:start -->
```json
{
  "schema_version": 1,
  "operation": {
    "operator": "operator-example",
    "window": {
      "id": "maintenance-window-example",
      "starts_at": "2026-08-01T00:00:00Z",
      "ends_at": "2026-08-01T04:00:00Z"
    }
  },
  "release_matrix": {
    "contracts": {
      "version": "v1.2.0",
      "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "released_at": "2026-01-01T00:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-contracts_v1.2.0.tar.gz",
          "autostream-contracts_v1.2.0.tar.gz.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    "control_panel": {
      "version": "v1.8.0",
      "commit": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "released_at": "2026-01-01T01:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-control-panel_v1.8.0_linux_amd64.tar.gz",
          "autostream-control-panel_v1.8.0_linux_amd64.tar.gz.sha256",
          "autostream-control-panel_v1.8.0_linux_arm64.tar.gz",
          "autostream-control-panel_v1.8.0_linux_arm64.tar.gz.sha256",
          "autostream-update-host_v1.8.0_linux_amd64.tar.gz",
          "autostream-update-host_v1.8.0_linux_amd64.tar.gz.sha256",
          "autostream-update-host_v1.8.0_linux_arm64.tar.gz",
          "autostream-update-host_v1.8.0_linux_arm64.tar.gz.sha256",
          "autostream-host-agent_v1.8.0_linux_amd64.tar.gz",
          "autostream-host-agent_v1.8.0_linux_amd64.tar.gz.sha256",
          "autostream-host-agent_v1.8.0_linux_arm64.tar.gz",
          "autostream-host-agent_v1.8.0_linux_arm64.tar.gz.sha256",
          "host-agent-manifest.json",
          "host-agent-manifest.json.sha256",
          "release-manifest.json",
          "release-manifest.json.sha256",
          "update-host-bootstrap-manifest.json",
          "update-host-bootstrap-manifest.json.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    "worker": {
      "version": "v1.2.0",
      "commit": "cccccccccccccccccccccccccccccccccccccccc",
      "released_at": "2026-01-01T02:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-worker_v1.2.0_linux_amd64.tar.gz",
          "autostream-worker_v1.2.0_linux_amd64.tar.gz.sha256",
          "autostream-worker_v1.2.0_linux_arm64.tar.gz",
          "autostream-worker_v1.2.0_linux_arm64.tar.gz.sha256",
          "release-manifest.json",
          "release-manifest.json.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    "encoder_recorder": {
      "version": "v1.2.0",
      "commit": "dddddddddddddddddddddddddddddddddddddddd",
      "released_at": "2026-01-01T02:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-encoder-recorder_v1.2.0_linux_amd64.tar.gz",
          "autostream-encoder-recorder_v1.2.0_linux_amd64.tar.gz.sha256",
          "autostream-encoder-recorder_v1.2.0_linux_arm64.tar.gz",
          "autostream-encoder-recorder_v1.2.0_linux_arm64.tar.gz.sha256",
          "release-manifest.json",
          "release-manifest.json.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    "discord_bot": {
      "version": "v1.2.0",
      "commit": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "released_at": "2026-01-01T02:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-discord-bot_v1.2.0_linux_amd64.tar.gz",
          "autostream-discord-bot_v1.2.0_linux_amd64.tar.gz.sha256",
          "autostream-discord-bot_v1.2.0_linux_arm64.tar.gz",
          "autostream-discord-bot_v1.2.0_linux_arm64.tar.gz.sha256",
          "release-manifest.json",
          "release-manifest.json.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    "observability": {
      "version": "v1.2.0",
      "commit": "ffffffffffffffffffffffffffffffffffffffff",
      "released_at": "2026-01-01T02:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-observability_v1.2.0_linux_amd64.tar.gz",
          "autostream-observability_v1.2.0_linux_amd64.tar.gz.sha256",
          "autostream-observability_v1.2.0_linux_arm64.tar.gz",
          "autostream-observability_v1.2.0_linux_arm64.tar.gz.sha256",
          "release-manifest.json",
          "release-manifest.json.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    "docker": {
      "version": "v1.4.0",
      "commit": "1111111111111111111111111111111111111111",
      "released_at": "2026-01-01T03:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "release-manifest.json",
          "release-manifest.json.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "images": [
        {
          "service": "control-panel",
          "manifest_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "manifest_attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "platforms": {
            "amd64": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "arm64": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }
        },
        {
          "service": "discord-bot",
          "manifest_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "manifest_attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "platforms": {
            "amd64": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "arm64": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }
        },
        {
          "service": "encoder-recorder",
          "manifest_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "manifest_attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "platforms": {
            "amd64": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "arm64": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }
        },
        {
          "service": "observability",
          "manifest_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "manifest_attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "platforms": {
            "amd64": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "arm64": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }
        },
        {
          "service": "worker",
          "manifest_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "manifest_attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          "platforms": {
            "amd64": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "arm64": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }
        }
      ],
      "source_versions": {
        "control-panel": {
          "version": "v1.8.0",
          "commit": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        },
        "worker": {
          "version": "v1.2.0",
          "commit": "cccccccccccccccccccccccccccccccccccccccc"
        },
        "encoder-recorder": {
          "version": "v1.2.0",
          "commit": "dddddddddddddddddddddddddddddddddddddddd"
        },
        "discord-bot": {
          "version": "v1.2.0",
          "commit": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
        },
        "observability": {
          "version": "v1.2.0",
          "commit": "ffffffffffffffffffffffffffffffffffffffff"
        }
      }
    },
    "docs": {
      "version": "v1.0.0",
      "commit": "2222222222222222222222222222222222222222",
      "released_at": "2026-01-01T04:00:00Z",
      "immutable": true,
      "release_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "tag_commit_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "asset_set": {
        "names": [
          "autostream-docs_v1.0.0_static.tar.gz",
          "autostream-docs_v1.0.0_static.tar.gz.sha256"
        ],
        "metadata_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "checksum_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "attestation_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    }
  },
  "control_plane_roster": {
    "revision": 57,
    "exported_at": "2026-01-01T05:00:00Z",
    "export_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "execution_host_ids": [
      "host-non-control-systemd-example",
      "host-non-control-docker-example",
      "host-control-panel-example"
    ]
  },
  "hosts": [
    {
      "execution_host_id": "host-non-control-systemd-example",
      "role": "non_control",
      "runtime": "systemd",
      "architecture": "amd64",
      "targets": [
        {
          "service": "worker",
          "current_ports": {
            "advertised": 8082,
            "listen": 8082
          }
        }
      ],
      "rollback_baseline": {
        "version": "v0.0.0-bridge-baseline",
        "commit": "2222222222222222222222222222222222222222",
        "verified": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "targets": [
          {
            "service": "worker",
            "current_ports": {
              "advertised": 8082,
              "listen": 8082
            }
          }
        ]
      },
      "transport": {
        "type": "ssh_v1",
        "ownership_epoch": 4
      },
      "agent": {
        "mode": "observer",
        "reported_epoch": 0,
        "probe": {
          "passed": true,
          "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
      },
      "active_job": false,
      "recovery": false,
      "migration": {
        "status": "unmigrated",
        "reason": "scheduled after canary evidence is accepted"
      },
      "network": {
        "listener_snapshot": null,
        "firewall_snapshot": {
          "external_tcp_22_blocked": false,
          "external_tcp_8090_blocked": false,
          "evidence": null
        }
      },
      "canary": null
    },
    {
      "execution_host_id": "host-non-control-docker-example",
      "role": "non_control",
      "runtime": "docker",
      "architecture": "arm64",
      "targets": [
        {
          "service": "encoder-recorder",
          "current_ports": {
            "advertised": 8083,
            "published": 18083,
            "container": 8083
          }
        }
      ],
      "rollback_baseline": {
        "version": "v0.0.0-bridge-baseline",
        "commit": "3333333333333333333333333333333333333333",
        "verified": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "targets": [
          {
            "service": "encoder-recorder",
            "current_ports": {
              "advertised": 8083,
              "published": 18083,
              "container": 8083
            }
          }
        ]
      },
      "transport": {
        "type": "ssh_v1",
        "ownership_epoch": 6
      },
      "agent": {
        "mode": "observer",
        "reported_epoch": 0,
        "probe": {
          "passed": true,
          "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
      },
      "active_job": false,
      "recovery": false,
      "migration": {
        "status": "unmigrated",
        "reason": "scheduled after canary evidence is accepted"
      },
      "network": {
        "listener_snapshot": null,
        "firewall_snapshot": {
          "external_tcp_22_blocked": false,
          "external_tcp_8090_blocked": false,
          "evidence": null
        }
      },
      "canary": null
    },
    {
      "execution_host_id": "host-control-panel-example",
      "role": "control_panel",
      "runtime": "systemd",
      "architecture": "amd64",
      "targets": [
        {
          "service": "control-panel",
          "current_ports": {
            "advertised": 8080,
            "listen": 8080
          }
        }
      ],
      "rollback_baseline": {
        "version": "v0.0.0-bridge-baseline",
        "commit": "4444444444444444444444444444444444444444",
        "verified": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "targets": [
          {
            "service": "control-panel",
            "current_ports": {
              "advertised": 8080,
              "listen": 8080
            }
          }
        ]
      },
      "transport": {
        "type": "ssh_v1",
        "ownership_epoch": 8
      },
      "agent": {
        "mode": "observer",
        "reported_epoch": 0,
        "probe": {
          "passed": true,
          "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
      },
      "active_job": false,
      "recovery": false,
      "migration": {
        "status": "unmigrated",
        "reason": "Control Panel host migrates last"
      },
      "network": {
        "listener_snapshot": null,
        "firewall_snapshot": {
          "external_tcp_22_blocked": false,
          "external_tcp_8090_blocked": false,
          "evidence": null
        }
      },
      "canary": null
    }
  ],
  "phase_receipts": {},
  "bake": null,
  "legacy_removal": null
}
```
<!-- bridge-fleet-gate-template:end -->

systemdでは`advertised`と`listen`を記録します。Dockerでは内部と外部を混同しない
よう、`advertised`、loopbackへpublishする`published`、container内の
`container`を別々に記録します。rollback baselineは同じtarget集合を持ち、
version、commit、port、検証evidenceを固定します。

## Release gate

公開操作はoperatorが手動で行います。既存tagを動かさず、失敗・partial releaseは
同じversionを再利用しません。全releaseを1つの`release_matrix`へ記録し、
`release`を実行します。CLIが強制する順序は次です。

1. additive Contracts
2. Bridge Control Panel Host Release
3. Worker、Encoder Recorder、Discord Bot、Observability Host Release
4. 5 imageをversionとdigestへ固定したDocker bundle
5. Docs

Bridge Control Panel Host ReleaseはBridge期間中の旧12 assetを残し、Host Agent /
Local Executor追加後のexact 18 asset set、asset metadata SHA-256、attestation、
immutable release、tag commitを記録します。各Node releaseはexact 6 asset、
Docker bundleはexact 2 manifest assetと5 imageすべてのmanifest digest、
amd64 / arm64 platform digest、manifest attestationを記録します。さらに
`source_versions`へcontrol-panelとNode 4 serviceのversion / commitをexactに固定し、
同じ`release_matrix`の各source releaseと一致させます。

`control_plane_roster`はrelease matrix完了後にauthoritative Control Panelから
exportし、revision、export SHA-256、evidence、全execution host IDを記録します。
release matrixの最終時刻と同時刻のexportも拒否します。roster ID集合と`hosts`
ID集合が完全一致しなければ停止します。

`release`は次のどれかがあると停止します。

- release matrixのcomponentが欠落し、または順序が上記と異なる
- version、40-hex commit、release完了時刻、immutable release proofがない
- exact asset名、metadata SHA-256、checksum evidence、attestation evidenceがない
- Docker 5 imageのmanifest / platform digestまたはattestationがない
- Docker `source_versions`の5 serviceが欠落・余分、またはmatrixのsourceと不一致
- authoritative rosterのrevision、export proof、exact host ID集合がない
- duplicate host ID、空のhost一覧、role/runtime/architecture不明
- target/current portまたはverified rollback baselineがない
- migration statusがない、または`unmigrated`なのに理由がない
- Host Agent observer/probe、transport/epochが矛盾する
- active jobまたはrecoveryがある
- all-zero / 同一hexのplaceholder SHA-256がある
- secret-like keyまたはhigh-confidence secret-like valueがある

release proofだけを通しても、実host canaryやfleet移行の証明にはなりません。

## Phase receiptを連鎖する

各phaseの`PASS`後は、その時点のinventoryと固定形式のgate出力を保存し、
次phaseの`phase_receipts`へ`completed_at`、`inventory_sha256`、
`gate_output_sha256`を追加します。先頭の`release.previous_inventory_sha256`は
`null`、以降は直前receiptの`inventory_sha256`と完全一致させます。

```json
{
  "phase_receipts": {
    "release": {
      "completed_at": "2026-01-01T06:00:00Z",
      "inventory_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "previous_inventory_sha256": null,
      "gate_output_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "release_matrix_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "roster_export_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  }
}
```

CLIは対象phaseより前のreceiptだけを許可し、receipt時刻、canary時刻、host移行時刻を
`release`、`systemd-canary`、`docker-canary`、`fleet-non-control`、
`fleet-control`の順に照合します。完了時刻が未来、同時刻、または逆順なら停止します。
calendarに存在しない日付をNode.jsの時刻正規化へ委ねず拒否し、phase間で同じ
`inventory_sha256`を再利用することも拒否します。
`release_matrix_sha256`はkeyを辞書順にしたcanonical JSONのSHA-256で、Docker
`source_versions`も含みます。`roster_export_sha256`はcurrent inventoryの
`control_plane_roster.export_sha256`と一致させます。`inventory_sha256`はreceiptを
作った時点でrepository外へ保存したinventory file自体のSHA-256であり、現在fileから
その場で作る自己参照値ではありません。

## Canary evidenceを記録する

canary hostを`pull_v2`へ切り替えた後は、同じhost entryを次の状態へ更新します。

```json
{
  "transport": {
    "type": "pull_v2",
    "ownership_epoch": 7
  },
  "agent": {
    "mode": "active",
    "reported_epoch": 7,
    "probe": {
      "passed": true,
      "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  },
  "active_job": false,
  "recovery": false,
  "migration": {
    "status": "migrated",
    "completed_at": "2026-01-01T07:00:00Z",
    "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "activation": {
      "owner": "pull_v2",
      "server_epoch": 7,
      "agent_reported_epoch": 7
    }
  },
  "network": {
    "listener_snapshot": {
      "tcp_22_state": "absent",
      "tcp_8090_state": "absent",
      "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    },
    "firewall_snapshot": {
      "external_tcp_22_blocked": true,
      "external_tcp_8090_blocked": true,
      "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  },
  "canary": {
    "runtime": "systemd",
    "passed": true,
    "completed_at": "2026-01-01T07:00:00Z",
    "proofs": {
      "ssh_free_update": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "forced_software_rollback": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "port_change": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "control_panel_outage_recovery": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "agent_restart_recovery": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "host_agent_self_update": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "local_executor_self_update": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "runtime_token_rotation": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "process_kill_recovery": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "host_reboot_recovery": {
        "passed": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "outbound_https_with_22_8090_blocked": {
        "passed": true,
        "heartbeat_accepted": true,
        "heartbeat_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "job_completed": true,
        "job_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "ownership_reverse_cas": {
        "passed": true,
        "starting_pull_epoch": 5,
        "restored_ssh_epoch": 6,
        "resumed_pull_epoch": 7,
        "bridge_version": "v1.8.0",
        "bridge_commit": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "old_agent_minimum_protocol_rejection": {
        "passed": true,
        "reason": "minimum_protocol",
        "minimum_recovery_protocol": 2,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      },
      "stage_grant_terminal_convergence": {
        "passed": true,
        "terminal_phase": "failed",
        "receipt_present": false,
        "replay_result": "no_op_success",
        "mismatched_binding_rejected": true,
        "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    }
  }
}
```

これはhost entry全体ではなく、更新するfieldの例です。`agent.probe`と
`rollback_baseline`は削除しません。

`systemd-canary`は、非Control Panelのsystemd hostで上記14 proofがすべてあり、
local 22/TCP・8090/TCP listenerが`absent`、外部22/TCP・8090/TCPが遮断された
snapshotのままcanaryが通るまで停止します。このphaseのreceiptができる前に
Docker canaryが存在するinventoryは、Docker操作の先行として拒否します。

`docker-canary`はsystemd canaryを維持した上で、非Control PanelのDocker hostにも
同じ14 proofを要求します。Docker mappingは`advertised`、`published`、
`container`を別々に照合します。このphase以降は、inventoryに存在するamd64 /
arm64の各architectureが、少なくとも1つの成功canaryで覆われていなければ停止します。

`canary.passed=true`だけでは通りません。SSH-free update、forced software rollback、
port change、Control Panel outage recovery、Agent restart recovery、Host Agent /
Local Executor self-update、Runtime Token rotation、process kill、host reboot、
22/TCP・8090/TCP遮断下のoutbound HTTPSを個別に検証します。outbound proofは
heartbeat acceptanceとjob completionを別boolean・別evidenceで記録します。
さらに、Bridge releaseへbindしたpull→ssh→pullの連続epoch reverse CAS、protocol 2
未満のold Agentが`minimum_protocol`で拒否されること、失敗stage grantがreceiptなしの
terminal `failed`へ収束し、replayが`no_op_success`、binding不一致が拒否されることを
typed fieldで記録します。

## Fleetをhost単位で移行する

各操作前にControl Panelの最新状態とlocal probeを読み直し、active job、
recovery、rotation、self-updateがないことを確認します。応答喪失時は同じmutationを
推測で再実行せず、durable stateをreconcileしてinventoryを更新します。

`fleet-non-control`は次を要求します。

- systemd / Docker canaryが両方成功している
- 全`non_control` hostが`pull_v2`、正のownership epoch、同じreported epoch
- 全`non_control` hostのactivation owner / server epoch / Agent reported epochが
  現在のtransport / Agent stateと一致し、migration evidenceがある
- 全`non_control` hostでlocal 22/TCP・8090/TCP listenerが`absent`であり、
  listener snapshot evidenceと外部遮断済みfirewall snapshot evidenceがある
- 全`control_panel` hostはまだ`unmigrated`でobserver epoch `0`

明示的な未移行理由は`release` / canary中のinventory分類には使えますが、
`fleet-non-control`を通過する例外にはなりません。

`fleet-control`は全hostがmigratedであり、各Control Panel hostの
`migration.completed_at`が全non-control hostより後であることを要求します。
同時刻は順序不明として拒否します。Control Panel hostを先に切り替えたinventoryも
phaseに関係なく拒否します。非canary hostも同じmigration activation binding、
listener / firewall snapshot evidenceを省略できません。次phaseではControl Panel
migrationが`fleet-control` receiptより前であることも照合します。

Bridge期間のapplication rollback先は、`ssh_v1`と`pull_v2`の両方を理解する
verified Bridge baselineです。ownershipを`ssh_v1`へ戻す操作が、その時点の
Control Panel contractで明示的に提供・検証されていない場合は、自動rollbackと
記録せずmanual recoveryとして停止します。SSH / 8090 assetはbake完了まで削除せず、
無効化して保持します。

## Bakeとlegacy removal

全hostの`fleet-control`が通った後、実際に観測したbakeを記録します。

```json
{
  "bake": {
    "started_at": "2026-01-01T14:00:00Z",
    "completed_at": "2026-01-02T14:00:00Z",
    "minimum_hours": 24,
    "incident_free": true,
    "evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
  },
  "legacy_removal": {
    "separate_release": true,
    "version": "v1.9.0",
    "commit": "3333333333333333333333333333333333333333",
    "change_evidence": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

`operation.window.starts_at`もbake完了より後のlegacy撤去windowへ更新します。
`bake.started_at`は`fleet-control` receiptより後、`minimum_hours`は24以上でなければ
なりません。bake完了を含む完了時刻は未来値を許可しません。
`legacy-removal`は次の条件で停止します。

- systemd / Docker canaryまたは全host移行が未完了
- bake開始・完了・最小時間・incident-free evidenceがない
- 実bake時間が`minimum_hours`未満
- legacy撤去windowがbake完了以前
- Bridge Control Panel releaseと同じversionまたはcommitを再利用している
- `separate_release=true`ではない

このphaseの`PASS`は、別releaseでlegacy撤去を開始できるpreflightです。削除完了の
証明ではありません。撤去後は中央Updater、8090 listener、SSH key、
`authorized_keys` entry、sshd drop-in、remote helper、SSH bootstrap UI/docsが
残っていないことと、22/TCP / 8090/TCP遮断下のsystemd / Docker E2Eを別途保存します。
legacy削除後の`ssh_v1`復帰はautomatic rollbackではなくmanual recoveryです。

## GateがFAILしたとき

1. 次のrelease、ownership切替、port変更、Control Panel host移行、legacy削除を止めます。
2. stderrのJSON pathを実Control Panel state、root ledger、service state、
   firewall probe、公開release proofと照合します。
3. active/recoveryまたは応答不明なら、再applyせずreconcile / rollbackを完了します。
4. 誤記を直す場合も、過去のPASS inventoryを上書きせず新しい監査copyを作ります。
5. 修正後に同じphaseを再実行し、そのPASS出力とinventory SHA-256を保存します。

CLI自身のregressionはlive inventoryなしで実行できます。

```bash
npm run bridge:fleet-gate:test
npm run docs:check
```
