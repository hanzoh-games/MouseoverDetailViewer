Mouseover Detail Viewer
========================================

Path of Exile の公式トレード画面で、アイテム特有の効果/効能で、ゲーム内特有の名前しか書かれていない物を、トレード画面の表示行にマウスカーソルを重ねると、その効果/効能を行のすぐ下に表示する Tool です。
又今表示されている詳細情報を知りたい時に POEDB/POE2DB に直接 Jump できるボタンを配置しました。
POEDB などで調べ直す手間を軽減させます。

この機能を動作させるために、別途ブラウザ用の拡張機能(Tampermonkey)を使用します。
Mouseover Detail Viewer はその拡張機能の土台を利用して動作するスクリプトです。

(English follows below.)


■ 表示できる物

・「パッシブスキルを1個追加: 前衛」などの行(クラスタージュエル・ミセリウムコアなど)
・「トリックショット を割り当てる」などのアノイントの行、禁じられた炎・禁じられた肉体の行
・「アイアンリフレックス」「コラプテッドソウル」などのキーストーン名の行
・「装備するとレベル20冷気のイージスをトリガーする」などの、アイテムが付与するスキルの行(行に書かれたレベルの数値で表示します)
・「ソケットされたジェムはレベル20 投射物回帰サポートによってサポートされる」などの、サポートジェムと同じ効果の行(行に書かれたレベルの数値で表示します)
・「召喚したスケルトンはアバターオブファイヤーを持つ」「ヘラルドオブサンダーのマナリザーブ効率が20%増加する」などの、キーストーン名・スキル名が入った行(1つの行に名前が2つ以上ある時は、全部を並べて表示します)
・「ヒット時に敵を灰まみれにする」などの、ゲーム内で説明文が付く言葉(灰まみれ・挑発など)が入った行

対応する画面: POE1 の日本語・英語画面、POE2 の英語画面(Chrome・Edge)。


■ DB ボタン

トレード画面の左上に、「DB」ボタンが常に表示されます。押すと、POEDB(POE2 のトレード画面では POE2DB)を新しいタブで開きます。

・Jump 先は、
　-検索条件で種類フィルターの「アイテムカテゴリー」を選択した時は、その種類のページ(例: 弓が検索されていれば POEDB/POE2DB 上の弓のページ)を開きます。
　-未選択の時は、検索結果のアイテムの種類のページを開きます。
　-分からない時は、トップページを開きます。
・日本語画面では日本語ページ、それ以外の言語画面では英語ページを開きます。
・ボタンの外側の枠をドラッグすると、場所を移動できます。移動した場所は次回も同じです。
・日本語・英語以外の言語画面では、このボタンだけが動きます。


■ インストール方法

1. Chrome か Edge に、拡張機能の Tampermonkey をインストールします。
   ・Chrome: Chrome ウェブストアの次のページを開き、「Chrome に追加」を押します。
     https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo
   ・Edge: Edge アドオンの次のページを開き、「インストール」を押します。
     https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd
2. Tampermonkey が Mouseover Detail Viewer を動かせるようにします。
   ・Chrome: 拡張機能の管理画面(chrome://extensions)で、Tampermonkey の「詳細」(Details)を開き、「ユーザー スクリプトを許可する」(Allow User Scripts)を有効にします。
   ・Edge: 拡張機能の管理画面(edge://extensions)で、「開発者モード」(Developer mode)を有効にします。
3. 次のアドレスを開き、Tampermonkey の画面で「インストール」を押します。
   https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js

「全部のサイトのデータの読み取りと変更」と表示されても大丈夫です
これは Tampermonkey が、いろいろなサイト用の機能を動かせる道具だから表示されます。Mouseover Detail Viewer が動くのは Path of Exile のトレードページだけで、他のサイトでは何もしません。インストール画面でも、動くページ(pathofexile.com/trade)と接続先(GitHub)の一覧で確認できます。


■ 最初にすること

トレード画面を開くと、右下に「効果データ ★ 押すとデータを取得します」が表示されます。これを1回押してください。データ取得には10秒ほどかかります。終わった後は、行にマウスカーソルを重ねるだけです。

・ゲームデータが新しくなった時は、右下に「効果データ ★ 新しいデータがあります」が表示されます。押すと更新します(トレード画面を開いた時に、前の確認から24時間以上たっていれば確認します)。
・いつでも、Tampermonkey のメニューの「データを更新」から更新できます。
・日本語画面と英語画面では、別々にデータを取得します。


■ Mouseover Detail Viewer の更新について

Mouseover Detail Viewer が新しくなると、Tampermonkey が自動で入れ替えます(Tampermonkey の初期設定では、約1日ごとに確認します)。開いたままのトレード画面では、前の Mouseover Detail Viewer が動き続けるので、読み込み直してください(F5 キー)。ブラウザを閉じる必要はありません。
読み込み直した後、右下に「効果データ ★ 新しいデータがあります」が表示された時は、押して効果データを作り直してください。


■ 困った時

・Tampermonkey のアイコンに赤い数字(1 など)が付いている
  更新のお知らせではありません。そのページで動いている、Tampermonkey に入れた機能の数です。トレード画面では、Mouseover Detail Viewer が動いているので「1」と表示されます。数字を表示しないようにするには、次の手順で設定してください。
  1. Tampermonkey のアイコン →「ダッシュボード」を開き、「設定」タブを押す
  2. 一番上の「設定のモード」を「上級者」にする
  3. 「操作メニュー」欄の「アイコン バッジの情報」を「無効」にし、その下の「保存」を押す
・何も表示されない
  「インストール方法」の2番を確認してください。Tampermonkey が Mouseover Detail Viewer を動かせない状態だと、何も表示されません。
・「GitHub の回数上限に達しました」と表示された
  1時間ほど待ってから、もう一度押してください。
・「データの中に見つかりませんでした」と表示された
  公開されているデータに、その効果文がありません(アイテムだけが持つ一部のキーストーンとスキル)。
・POE2 の日本語画面で表示されない
  POE2 の日本語データが公開されていないためです。トレード画面を英語に切り替えると表示できます。


■ データについて

Mouseover Detail Viewer にはゲームデータが入っていません。「効果データ ★」を押した時に、利用者のブラウザが次の公開データを取得します。取得するのは GitHub の公開データだけで、利用者の情報をどこかへ送ることはありません。トレード画面では、表示されている文を読むだけで、検索・売買などの操作は一切しません。

・RePoE(パッシブ・スキル・アイテムの文の翻訳): https://github.com/repoe-fork
・grindinggear/skilltree-export(公式パッシブスキルツリーのデータ): https://github.com/grindinggear/skilltree-export

Mouseover Detail Viewer は、Grinding Gear Games とは関係ありません。


========================================
English
========================================

On the official Path of Exile trade site, some item effects are shown only by an in-game name. Hover such a line on the trade page, and its effects are shown right below the line.
There is also a button that jumps straight to POEDB / POE2DB when you want to know more about what is shown.
It saves you the trouble of looking things up on POEDB and similar sites.

This tool needs a separate browser extension, Tampermonkey. Mouseover Detail Viewer is a script that runs on top of that extension.


■ What it shows

・"1 Added Passive Skill is ..." lines (cluster jewels, Mycelium Core, ...)
・"Allocates ..." lines (anointments, Forbidden Flame / Flesh)
・Keystone lines such as "Iron Reflexes" or "Corrupted Soul"
・Skills granted by items, such as "Triggers Level 20 Cold Aegis when Equipped" (values for the level on the line)
・Support gem lines such as "Socketed Gems are Supported by Level 20 Returning Projectiles" (values for the level on the line)
・Lines that name a keystone or skill, such as "Summoned Skeletons have Avatar of Fire" or "Herald of Thunder has 20% increased Mana Reservation Efficiency" (all names in the line are shown)
・Lines with a game word that has a reminder in the game, such as "Cover Enemies in Ash"

Supported: POE1 trade in Japanese and English, POE2 trade in English (Chrome, Edge).


■ DB button

A "DB" button is always shown at the top left of the trade page. Click it to open POEDB (POE2DB on the POE2 trade page) in a new tab.

・Where it jumps:
　- When "Item Category" in the Type Filters of the search is selected, the page of that category opens (e.g. when Bows are searched, the Bows page on POEDB / POE2DB).
　- When it is not selected, the page of the item class of the search results opens.
　- Otherwise, the top page opens.
・The Japanese trade page opens the Japanese page; trade pages in other languages open the English page.
・Drag the frame around the button to move it. The place is kept for next time.
・On trade pages in languages other than Japanese and English, only this button works.


■ Install

1. Install Tampermonkey in Chrome or Edge.
   ・Chrome: open this Chrome Web Store page and click "Add to Chrome".
     https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo
   ・Edge: open this Edge Add-ons page and click "Get".
     https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd
2. Let Tampermonkey run Mouseover Detail Viewer:
   ・Chrome: open chrome://extensions, open Tampermonkey's "Details", and turn on "Allow User Scripts".
   ・Edge: open edge://extensions and turn on "Developer mode".
3. Open this address and click "Install":
   https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js

"Read and change all your data on all websites" is shown
This is shown because Tampermonkey can run add-ons for any site. Mouseover Detail Viewer only runs on the Path of Exile trade pages and does nothing on other sites. The install screen also lists where it runs (pathofexile.com/trade) and what it connects to (GitHub).


■ First use

On the trade page, click "Detail data ★ Click to download" at the bottom right once (about 10 seconds). After that, just hover the mouse cursor over the lines.

・When the game data is new, "Detail data ★ New data available" is shown at the bottom right. Click it to update (checked when you open the trade page, if 24 hours or more have passed since the last check).
・You can update at any time with "Update data" in the Tampermonkey menu.
・The Japanese and English trade pages download their data separately.


■ Updates of Mouseover Detail Viewer

When Mouseover Detail Viewer is updated, Tampermonkey replaces it automatically (with Tampermonkey's default settings, it checks about once a day). A trade page that is already open keeps running the old version, so reload it (F5). You do not need to close the browser.
If "Detail data ★ New data available" appears at the bottom right after reloading, click it to rebuild the detail data.


■ Troubleshooting

・A red number (such as 1) is on the Tampermonkey icon
  It is not an update notice. It is the number of Tampermonkey add-ons running on that page. On the trade page Mouseover Detail Viewer runs, so "1" is shown. To hide the number:
  1. Click the Tampermonkey icon -> "Dashboard", then open the "Settings" tab.
  2. Set "Config mode" at the top to "Advanced".
  3. In "Action Menu", set "Icon badge info" to "Disabled", then click "Save" below it.
・Nothing is shown
  Check step 2 of "Install". If Tampermonkey cannot run Mouseover Detail Viewer, nothing is shown.
・"GitHub request limit reached" is shown
  Wait about an hour, then click again.
・"... were not found in the data" is shown
  The public data has no effect text for it (some keystones and skills that only items have).
・Nothing is shown on the Japanese POE2 trade page
  The Japanese POE2 data is not published. Switch the trade page to English to see the effects.


■ Data

Mouseover Detail Viewer includes no game data. When you click "Detail data ★", your browser downloads the public data below. It only downloads public data on GitHub, and nothing about you is sent anywhere. On the trade page it only reads the shown text, and never searches, buys or sells.

・RePoE (translations of passive, skill and item texts): https://github.com/repoe-fork
・grindinggear/skilltree-export (the official passive skill tree data): https://github.com/grindinggear/skilltree-export

This project is not affiliated with Grinding Gear Games.


License: MIT
