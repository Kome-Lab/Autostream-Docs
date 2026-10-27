import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// This is a bounded documentation regression, not a CP behavior test or a
// general Japanese-language policy checker. Expectations come from the
// create/edit contract; no adjacent checkout, network or generated oracle.
const guides = [
  {
    path: 'docs/control-panel/streams.md',
    create: ['配信を新規作成する'],
    required: [['配信設定の項目'], ['サービス割り当て'], ['Start前チェック']],
    flows: [],
  },
  {
    path: 'docs/control-panel/page-usage.md',
    create: ['Streams', '新しい配信を作る'],
    required: [['Streams', 'Check Readiness の見方']],
    flows: [],
  },
  {
    path: 'docs/services/runtime-usage.md',
    create: ['Control Panel', '初回に最低限やること'],
    required: [],
    flows: [
      { headings: ['Control Panel', '日常で見るところ'], existing: true },
      { headings: ['Discord Bot', '使い方の流れ'] },
      { headings: ['Worker', '使い方の流れ'] },
      { headings: ['Encoder Recorder', '使い方の流れ'] },
    ],
  },
];

const visible = (text) => text.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*]/g, '');

function section(text, headings) {
  let body = text;
  for (const title of headings) {
    const headingsInBody = [...body.matchAll(/^(#{1,6}) (.+)$/gm)];
    const matches = headingsInBody.filter((heading) => heading[2] === title);
    assert.equal(matches.length, 1, `required section: ${headings.join(' / ')}`);
    const heading = matches[0];
    const next = headingsInBody.find((candidate) => candidate.index > heading.index && candidate[1].length <= heading[1].length);
    body = body.slice(heading.index + heading[0].length, next?.index).trim();
    assert.ok(body.length > 0, `empty section: ${title}`);
  }
  return body;
}

const selectedNodes = /担当Worker Node.{0,30}担当Encoder Node.{0,30}明示的に選択/;
const oldClaims = [
  ['single-node-auto', /Node[^。\n]*(?:1つ|一つ|１つ)[^。\n]*自動(?:選択|割り?当て?)(?:されます|します)/],
  ['missing-node-create', /Node未(?:割当|選択)でも[^。\n]*(?:新規)?作成できます/],
  ['create-no-assignment', /(?:作成時|新規作成)[^。\n]*(?:Worker\/Encoder|担当Node|primary assignment)[^。\n]*(?:自動割当しません|保存しません|割り当てません)/],
  ['other-stream-transfer', /他の配信枠[^。\n]*使用中[^。\n]*Node[^。\n]*(?:自動移管します|上書きします)/],
  ['partial-create', /割当[^。\n]*失敗[^。\n]*枠だけ[^。\n]*作成(?:できます|成功します)/],
  ['create-is-ready', /作成成功(?:だけ|のみ)[^。\n]*(?:開始できます|開始可能です|Startできます)/],
  ['no-schedule-input', /(?:開始日時や終了日時|日時|開始予定)(?:を|は)[^。\n]*(?:設定しません|入力しません|入力できません|指定できません)/],
  ['timer-start', /(?:予定時刻|指定日時)[^。\n]*AutoStream[^。\n]*Start[^。\n]*自動実行(?:します|されます)/],
  ['permission-bypass', /権限(?:がない場合|がなくても|なしで)[^\n]*(?:Service Health|Worker Management|別画面)[^。\n]*(?:割り当てます|割り当てられます|割当できます)/],
  ['permission-bypass', /(?:Service Health|Worker Management|別画面)[^。\n]*権限(?:不要|なし|がなくても)[^。\n]*(?:割当できます|割り当てられます)/],
];

function checkFlow(body, existing = false) {
  const steps = [...body.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]).join('\n');
  const sequence = [
    ...(existing ? [/割当の不足や変更がある場合/, /作成済み.{0,30}待機中.{0,30}終了済み.{0,30}編集/] : []),
    selectedNodes,
    ...(existing ? [/設定を保存/] : [/配信枠を作成/, /作成成功.{0,60}確認/]),
    /実際のprimary assignment/,
    /Check Readiness|開始準備を再確認/,
    /手動.{0,20}Start.{0,40}Discord VC参加/,
  ];
  let cursor = 0;
  for (const expected of sequence) {
    const match = expected.exec(steps.slice(cursor));
    assert.ok(match, `ordered procedure: ${expected}`);
    cursor += match.index + match[0].length;
  }
  const saved = steps.indexOf(existing ? '設定を保存' : '作成成功');
  assert.ok(saved >= 0 && steps.search(/Check Readiness|開始準備を再確認/) > saved, 'Readiness must follow successful assignment save');
}

function checkGuide(guide, source) {
  assert.equal(typeof source, 'string', `missing document: ${guide.path}`);
  const text = visible(source);
  assert.ok(text.trim(), `empty document: ${guide.path}`);
  for (const [label, pattern] of oldClaims) assert.doesNotMatch(text, pattern, label);
  for (const headings of guide.required) section(text, headings);
  const create = section(text, guide.create);
  checkFlow(create);
  for (const flow of guide.flows) checkFlow(section(text, flow.headings), flow.existing);

  for (const expected of [
    /担当Worker Nodeと担当Encoder Nodeの両方が必須/,
    /未選択のNodeを自動選択しません/,
    /配信枠とprimary assignmentをまとめて保存/,
    /Discord BOT設定[^。]*選択済みBot[^。]*同じ保存処理/,
    /services.assign/,
    /workers.assign/,
    /作成成功だけで開始可能とは判断しません/,
    /割当権限がない場合.{0,40}権限のある管理者・担当者へ依頼/,
    /録画プロファイル/,
    /録画しない/,
    /先に[^\n]*録画・アーカイブ[^\n]*保存先[^\n]*録画形式[^\n]*保持日数[^\n]*準備/,
    /YouTube開始予定/,
    /開始予定（任意）/,
    /ブラウザのタイムゾーン/,
    /空欄なら、配信開始時にYouTubeの枠をすぐ開始/,
    /日時を指定した場合だけYouTubeの予定配信/,
    /YouTube予定とAutoStreamの開始トリガーは別/,
    /予定時刻だけでAutoStreamのStartを自動実行する機能ではありません/,
  ]) assert.match(create, expected, `required creation guidance: ${expected}`);

  // Direct archive fields remain valid in their own settings screens and API.
  // Only affirmative direct-entry instructions in the creation procedure fail.
  for (const sentence of create.split(/[。\n]/)) {
    if (/(?:Google\s*(?:account|アカウント)|Folder ID|共有ドライブID|録画ファイル名|保持日数)[^。]*(?:入力します|選びます|直接指定します)/i.test(sentence)
      && !/(?:録画・アーカイブ|録画設定|Archive|Drive保存先|保存先設定)(?:画面|側|で|の)/.test(sentence)) {
      assert.fail('direct-archive-input');
    }
  }
  for (const expected of [
    /Service Health[^。\n]*Worker Management[^。\n]*権限が必要/,
    /所有権や競合保護を回避しない/,
    /競合が表示されたら[^。\n]*割当を再確認/,
    /ライブ調整は通常のNode割当変更には使いません/,
  ]) assert.match(text, expected, `required assignment protection: ${expected}`);
  if (guide.path.endsWith('/streams.md')) {
    const fields = section(text, ['配信設定の項目']);
    assert.match(fields, /担当Encoder Node（作成時必須）/, 'required section guidance: Encoder field');
    assert.match(fields, /担当Worker Node（作成時必須）/, 'required section guidance: Worker field');
    assert.match(fields, /未選択では作成できません/, 'required section guidance: required create nodes');
    assert.match(section(text, ['Start前チェック']), /Service assignment[^\n]*権限のある担当者/, 'required section guidance: readiness');
    const assignment = section(text, ['サービス割り当て']);
    assert.match(assignment, /services.assign/);
    assert.match(assignment, /workers.assign/);
    assert.match(assignment, /選択済み[^。]*primary Discord Bot assignment[^。]*開始前の監視/);
    assert.match(assignment, /current binding/);
  }
  if (guide.path.endsWith('/page-usage.md')) {
    assert.match(section(text, ['Streams', 'Check Readiness の見方']), /missing assignment[^\n]*権限のある担当者/, 'required section guidance: readiness');
  }
  if (guide.path.endsWith('/runtime-usage.md')) {
    const discord = section(text, ['Discord Bot']);
    assert.match(discord, /待機枠[^。]*選択済みBotのprimary Discord Bot assignment/);
    assert.match(discord, /current binding/);
    assert.match(discord, /Gateway[^。]*既存の在席/);
    assert.match(discord, /jobs\/start/);
  }
}

const read = (guide) => readFileSync(new URL(`../${guide.path}`, import.meta.url), 'utf8');
function appendToCreate(guide, source, line) {
  const marker = `${'#'.repeat(guide.create.length + 1)} ${guide.create.at(-1)}`;
  assert.ok(source.includes(marker), 'mutation must reach the creation section');
  const mutated = source.replace(marker, `${marker}\n\n${line}`);
  assert.notEqual(mutated, source);
  return mutated;
}

const regressions = [
  ['single-node-auto', 'Nodeが1つだけなら自動選択されます。'],
  ['missing-node-create', 'Node未割当でも新規作成できます。'],
  ['missing-node-create', 'Node未選択でも配信枠を作成できます。'],
  ['create-no-assignment', '作成時には新規枠のWorker/Encoderを自動割当しません。'],
  ['create-no-assignment', '新規作成ではprimary assignmentを保存しません。'],
  ['other-stream-transfer', '他の配信枠で使用中のNodeは自動移管します。'],
  ['partial-create', 'Nodeの割当が失敗しても枠だけ作成できます。'],
  ['create-is-ready', '作成成功だけで配信開始可能です。'],
  ['direct-archive-input', '標準作成フォームでFolder ID、共有ドライブID、録画ファイル名、保持日数を入力します。'],
  ['direct-archive-input', 'YouTube出力と録画用Googleアカウントを選びます。'],
  ['no-schedule-input', '配信枠には開始日時や終了日時を設定しません。'],
  ['timer-start', '予定時刻だけでAutoStreamのStartを自動実行します。'],
  ['permission-bypass', '割当権限がなくてもService Healthで割り当てられます。'],
  ['permission-bypass', '割当権限がない場合、Streams画面では保存できません。その場合は Worker Management で割り当てます。'],
];

for (const guide of guides) {
  test(`${guide.path}: actual creation and assignment guidance`, () => checkGuide(guide, read(guide)));
  for (const [label, claim] of regressions) {
    test(`${guide.path}: rejects ${claim}`, () => {
      assert.throws(() => checkGuide(guide, appendToCreate(guide, read(guide), claim)), new RegExp(label));
    });
  }
  test(`${guide.path}: accepts explicit create selection, guarded editing and archive-screen fields`, () => {
    const source = read(guide);
    const allowed = '作成画面で担当Worker Nodeと担当Encoder Nodeを選びます。Node未選択では新規作成できません。\n割当変更が必要な場合は作成済み枠を編集します。Nodeが一つでも自動選択しません。\n録画・アーカイブ画面でFolder IDと共有ドライブIDを入力します。';
    assert.doesNotThrow(() => checkGuide(guide, appendToCreate(guide, source, allowed)));
  });
  for (const headings of [guide.create, ...guide.required, ...guide.flows.map((flow) => flow.headings)]) {
    test(`${guide.path}: rejects missing ${headings.join(' / ')}`, () => {
      const source = read(guide);
      const body = section(visible(source), headings);
      const mutated = visible(source).replace(body, '手順は別ページを参照してください。');
      assert.notEqual(mutated, visible(source));
      assert.throws(() => checkGuide(guide, mutated), /ordered procedure|required creation guidance|required assignment protection|services.assign|workers.assign|required section|empty section/);
    });
  }
  for (const source of [undefined, '', '<!-- 作成手順だけのコメント -->']) {
    test(`${guide.path}: rejects absent or empty document (${String(source)})`, () => {
      assert.throws(() => checkGuide(guide, source), /missing document|empty document/);
    });
  }
  for (const flow of [{ headings: guide.create }, ...guide.flows]) {
    test(`${guide.path}: rejects Readiness before assignment in ${flow.headings.join(' / ')}`, () => {
      const source = visible(read(guide));
      const body = section(source, flow.headings);
      const lines = body.split('\n');
      const assign = lines.findIndex((line) => /^\d+\. /.test(line) && (flow.existing ? /設定を保存/.test(line) : /作成成功/.test(line)));
      const readiness = lines.findIndex((line) => /^\d+\. .*(?:Check Readiness|開始準備を再確認)/.test(line));
      assert.ok(assign >= 0 && readiness > assign, 'mutation must swap real procedure steps');
      [lines[assign], lines[readiness]] = [lines[readiness], lines[assign]];
      assert.throws(() => checkGuide(guide, source.replace(body, lines.join('\n'))), /ordered procedure|Readiness must follow/);
    });
    if (!flow.existing) {
      test(`${guide.path}: rejects selecting nodes after create in ${flow.headings.join(' / ')}`, () => {
        const source = visible(read(guide));
        const body = section(source, flow.headings);
        const lines = body.split('\n');
        const nodes = lines.findIndex((line) => /^\d+\. /.test(line) && selectedNodes.test(line));
        const create = lines.findIndex((line, index) => index > nodes && /^\d+\. .*作成成功/.test(line));
        assert.ok(nodes >= 0 && create > nodes, 'mutation must swap real selection and creation steps');
        [lines[nodes], lines[create]] = [lines[create], lines[nodes]];
        assert.throws(() => checkGuide(guide, source.replace(body, lines.join('\n'))), /ordered procedure/);
      });
    }
  }
}
