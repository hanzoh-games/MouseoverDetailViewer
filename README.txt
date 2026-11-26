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

1. Tampermonkey をインストールする
   ① 下のアドレスをコピーして、ブラウザの一番上のアドレス欄に貼り付け、Enter キーを押す
      ・Chrome: https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo
      ・Edge: https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd
   ② 開いた Tampermonkey のページの右上にある、青いボタン「Chrome に追加」(Edge は「インストール」)を押す
   ③ 確認画面の「拡張機能を追加」(Edge は「拡張機能の追加」)を押す
2. Tampermonkey の「ユーザー スクリプトを許可する」を有効にする
   ① ブラウザの一番上のアドレス欄に chrome://extensions(Edge は edge://extensions)を入力して、Enter キーを押す
   ② Tampermonkey の「詳細」ボタンを押す
   ③ 「ユーザー スクリプトを許可する」の右のスイッチを押して、青くする
3. Mouseover Detail Viewer をインストールする
   ① 下のアドレスをコピーして、ブラウザの一番上のアドレス欄に貼り付け、Enter キーを押す
      https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js
   ② 開いた Tampermonkey の画面の「インストール」ボタンを押す

「全部のサイトのデータの読み取りと変更」と表示されても大丈夫です
これは Tampermonkey が、いろいろなサイト用の機能を動かせる道具だから表示されます。Mouseover Detail Viewer が動くのは Path of Exile のトレードページだけで、他のサイトでは何もしません。インストール画面でも、動くページ(pathofexile.com/trade)と接続先(GitHub)の一覧で確認できます。


■ 最初にすること

① トレード画面の右下に表示される「効果データ ★ 押すとデータを取得します」を押す(10秒ほどかかります)
② 調べたい行に、マウスカーソルを重ねる

・ゲームデータが新しくなると、右下に「効果データ ★ 新しいデータがあります」が表示されます。それを押すと更新します(トレード画面を開いた時に、前の確認から24時間以上たっていれば確認します)。
・ブラウザの右上の拡張機能ボタン(パズルの形)→「Tampermonkey」→「データを更新」の順に押すと、いつでも更新できます。
・日本語画面と英語画面では、別々にデータを取得します。


■ Mouseover Detail Viewer の更新について

Mouseover Detail Viewer が新しくなると、Tampermonkey が自動で入れ替えます(Tampermonkey の初期設定では、約1日ごとに確認します)。ブラウザを閉じる必要はありません。
① 開いたままのトレード画面で、F5 キーを押して読み込み直す
② 右下に「効果データ ★ 新しいデータがあります」が表示された時は、それを押す


■ 困った時

・Tampermonkey のアイコンに赤い数字(1 など)が付いている
  更新のお知らせではありません。そのページで動いている、Tampermonkey に入れた機能の数です。トレード画面では、Mouseover Detail Viewer が動いているので「1」と表示されます。数字を表示しないようにするには:
  ① ブラウザの右上の、赤い数字が付いた Tampermonkey のアイコンを押し、「ダッシュボード」を押す
  ② 開いた画面の上の「設定」タブを押す
  ③ 一番上の「設定のモード」を「上級者」にする
  ④ 「操作メニュー」欄の「アイコン バッジの情報」を「無効」にし、その下の「保存」を押す
・何も表示されない
  「インストール方法」の2番を、もう一度行ってください。
・「GitHub の回数上限に達しました」と表示された
  1時間ほど待ってから、右下の「効果データ ★」をもう一度押してください。
・「データの中に見つかりませんでした」と表示された
  公開されているデータに、その効果文がありません(アイテムだけが持つ一部のキーストーンとスキル)。
・POE2 の日本語画面で表示されない
  POE2 の日本語データが公開されていないためです。トレード画面の右上の国旗の並びから、イギリスの国旗を押して、英語画面に切り替えてください。


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

1. Install Tampermonkey
   ① Copy the address below, paste it into the address bar at the top of your browser, and press Enter
      ・Chrome: https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo
      ・Edge: https://microsoftedge.microsoft.com/addons/detail/iikmkjmpaadaobahmlepeloendndfphd
   ② On the Tampermonkey page that opens, click the blue button "Add to Chrome" (Edge: "Get") at the top right
   ③ In the confirmation, click "Add extension"
2. Turn on "Allow User Scripts" for Tampermonkey
   ① Type chrome://extensions (Edge: edge://extensions) into the address bar at the top of your browser, and press Enter
   ② Click the "Details" button of Tampermonkey
   ③ Click the switch to the right of "Allow User Scripts" so that it turns blue
3. Install Mouseover Detail Viewer
   ① Copy the address below, paste it into the address bar at the top of your browser, and press Enter
      https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js
   ② On the Tampermonkey screen that opens, click the "Install" button

"Read and change all your data on all websites" is shown
This is shown because Tampermonkey can run add-ons for any site. Mouseover Detail Viewer only runs on the Path of Exile trade pages and does nothing on other sites. The install screen also lists where it runs (pathofexile.com/trade) and what it connects to (GitHub).


■ First use

① Click "Detail data ★ Click to download" shown at the bottom right of the trade page (about 10 seconds)
② Hover the mouse cursor over the line you want to check

・When the game data is new, "Detail data ★ New data available" is shown at the bottom right. Click it to update (checked when you open the trade page, if 24 hours or more have passed since the last check).
・You can update at any time: click the extensions button (puzzle shape) at the top right of your browser → "Tampermonkey" → "Update data".
・The Japanese and English trade pages download their data separately.


■ Updates of Mouseover Detail Viewer

When Mouseover Detail Viewer is updated, Tampermonkey replaces it automatically (with Tampermonkey's default settings, it checks about once a day). You do not need to close the browser.
① On a trade page that is already open, press F5 to reload it
② If "Detail data ★ New data available" appears at the bottom right, click it


■ Troubleshooting

・A red number (such as 1) is on the Tampermonkey icon
  It is not an update notice. It is the number of Tampermonkey add-ons running on that page. On the trade page Mouseover Detail Viewer runs, so "1" is shown. To hide the number:
  ① Click the Tampermonkey icon with the red number at the top right of your browser, then click "Dashboard"
  ② Click the "Settings" tab at the top of the screen that opens
  ③ Set "Config mode" at the top to "Advanced"
  ④ In "Action Menu", set "Icon badge info" to "Disabled", then click "Save" below it
・Nothing is shown
  Do step 2 of "Install" again.
・"GitHub request limit reached" is shown
  Wait about an hour, then click "Detail data ★" at the bottom right again.
・"... were not found in the data" is shown
  The public data has no effect text for it (some keystones and skills that only items have).
・Nothing is shown on the Japanese POE2 trade page
  The Japanese POE2 data is not published. Click the UK flag at the top right of the trade page to switch to English.


■ Data

Mouseover Detail Viewer includes no game data. When you click "Detail data ★", your browser downloads the public data below. It only downloads public data on GitHub, and nothing about you is sent anywhere. On the trade page it only reads the shown text, and never searches, buys or sells.

・RePoE (translations of passive, skill and item texts): https://github.com/repoe-fork
・grindinggear/skilltree-export (the official passive skill tree data): https://github.com/grindinggear/skilltree-export

This project is not affiliated with Grinding Gear Games.


License: MIT
