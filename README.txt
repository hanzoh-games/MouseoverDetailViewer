Mouseover Detail Viewer
========================================

Path of Exile の公式トレードの画面で、アイテム特有の効果/効能で、ゲーム内特有の名前しか書かれていないものを、トレード画面の表示行にマウスを重ねると、その効果/効能を行のすぐ下に表示するToolです。
POEDB などで調べ直す手間を軽減させる目的で作成しました。

この機能を動作させるために、別途ブラウザ用の拡張機能（Tampermonkey）を使用します。
Mouseover Detail Viewerはその拡張機能の土台を利用して動作するスクリプトです。

(English follows below.)


■ 表示できる物

・「パッシブスキルを1個追加: 前衛」などの行(クラスタージュエル・ミセリウムコアなど)
・「トリックショット を割り当てる」などのアノイントの行、禁じられた炎・禁じられた肉体の行
・「アイアンリフレックス」「コラプテッドソウル」などのキーストーンの名前の行
・「装備するとレベル20冷気のイージスをトリガーする」などの、アイテムが付与するスキルの行(行に書かれたレベルの数値で表示します)

対応する画面: POE1 の日本語・英語の画面、POE2 の英語の画面(Chrome・Edge)。


■ インストール方法

1. Chrome か Edge に、拡張機能の Tampermonkey をインストールします。
   Tampermonkey: https://www.tampermonkey.net/
2. Tampermonkey が Mouseover Detail Viewer を動かせるようにします。
   ・Chrome: 拡張機能の管理の画面(chrome://extensions)で、Tampermonkey の「詳細」(Details)を開き、「ユーザー スクリプトを許可する」(Allow User Scripts)を有効にします。
   ・Edge: 拡張機能の管理の画面(edge://extensions)で、「開発者モード」(Developer mode)を有効にします。
3. 次のアドレスを開き、Tampermonkey の画面で「インストール」を押します。
   https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js

「全部のサイトのデータの読み取りと変更」と表示されても大丈夫です
これは Tampermonkey が、いろいろなサイト用の機能を動かせる道具だから表示されます。Mouseover Detail Viewer が動くのは Path of Exile のトレードのページだけで、他のサイトでは何もしません。インストールの画面でも、動くページ(pathofexile.com/trade)と接続先(GitHub)の一覧で確認できます。


■ 最初にすること

トレードの画面を開くと、右下に「効果データ ★ 押すとデータを取得します」が表示されます。これを1回押してください。データの取得には10秒ほどかかります。終わった後は、行にマウスを重ねるだけです。

・ゲームのデータが新しくなった時は、右下に「効果データ ★ 新しいデータがあります」が表示されます。押すと更新します(トレードの画面を開いた時に、前の確認から24時間以上たっていれば確認します)。
・いつでも、Tampermonkey のメニューの「データを更新」から更新できます。
・日本語の画面と英語の画面では、別々にデータを取得します。


■ Mouseover Detail Viewer の更新について

Mouseover Detail Viewer が新しくなると、Tampermonkey が自動で入れ替えます(Tampermonkey の初めの設定では、約1日ごとに確認します)。開いたままのトレードの画面では、前の Mouseover Detail Viewer が動き続けるので、読み込み直してください(F5 キー)。ブラウザを閉じる必要はありません。
読み込み直した後、右下に「効果データ ★ 新しいデータがあります」が表示された時は、押して効果データを作り直してください。


■ 困った時

・Tampermonkey のアイコンに赤い数字(1 など)が付いている
  更新のお知らせではありません。そのページで動いている、Tampermonkey に入れた機能の数です。トレードの画面では、Mouseover Detail Viewer が動いているので「1」と表示されます。数字を表示しないようにするには、次の手順で設定してください。
  1. Tampermonkey のアイコン →「ダッシュボード」を開き、「設定」のタブを押す
  2. 一番上の「設定のモード」を「上級者」にする
  3. 「操作メニュー」の欄の「アイコン バッジの情報」を「無効」にし、その下の「保存」を押す
・何も表示されない
  「インストール方法」の2番を確認してください。Tampermonkey が Mouseover Detail Viewer を動かせない状態だと、何も表示されません。
・「GitHub の回数の上限に達しました」と表示された
  1時間ほど待ってから、もう一度押してください。
・「データの中に見つかりませんでした」と表示された
  公開されているデータに、その効果の文がありません(アイテムだけが持つ一部のキーストーンとスキル)。
・POE2 の日本語の画面で表示されない
  POE2 の日本語のデータが公開されていないためです。トレードの画面を英語に切り替えると表示できます。


■ データについて

Mouseover Detail Viewer にはゲームのデータが入っていません。「効果データ ★」を押した時に、利用者のブラウザが次の公開データを取得します。取得するのは GitHub の公開データだけで、利用者の情報をどこかへ送ることはありません。トレードの画面では、表示されている文を読むだけで、検索・売買などの操作は一切しません。

・RePoE(パッシブ・スキル・アイテムの文の翻訳): https://github.com/repoe-fork
・grindinggear/skilltree-export(公式のパッシブスキルツリーのデータ): https://github.com/grindinggear/skilltree-export

Mouseover Detail Viewer は、Grinding Gear Games とは関係ありません。


========================================
English
========================================

On the official Path of Exile trade site, some item effects are shown only by an in-game name. Hover such a line, and its effects are shown right below the line. It was made to save you from looking things up on POEDB.

This tool needs a browser extension, Tampermonkey. Mouseover Detail Viewer is a script that runs on top of that extension.


■ What it shows

・"1 Added Passive Skill is ..." lines (cluster jewels, Mycelium Core, ...)
・"Allocates ..." lines (anointments, Forbidden Flame / Flesh)
・Keystone lines such as "Iron Reflexes" or "Corrupted Soul"
・Skills granted by items, such as "Triggers Level 20 Cold Aegis when Equipped" (values for the level on the line)

Supported: POE1 trade in Japanese and English, POE2 trade in English (Chrome, Edge).


■ Install

1. Install Tampermonkey in Chrome or Edge.
   Tampermonkey: https://www.tampermonkey.net/
2. Let Tampermonkey run Mouseover Detail Viewer:
   ・Chrome: open chrome://extensions, open Tampermonkey's "Details", and turn on "Allow User Scripts".
   ・Edge: open edge://extensions and turn on "Developer mode".
3. Open this address and click "Install":
   https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js

"Read and change all your data on all websites" is shown
This is shown because Tampermonkey can run add-ons for any site. Mouseover Detail Viewer only runs on the Path of Exile trade pages and does nothing on other sites. The install screen also lists where it runs (pathofexile.com/trade) and what it connects to (GitHub).


■ First use

On the trade page, click "Detail data ★ Click to download" at the bottom right once (about 10 seconds). After that, just hover the lines. When new game data is available, the button appears again ("New data available"; checked when you open the trade page, if 24 hours have passed since the last check). You can also use "Update data" in the Tampermonkey menu.


■ Updates of Mouseover Detail Viewer

When Mouseover Detail Viewer is updated, Tampermonkey replaces it automatically (with Tampermonkey's default settings, it checks about once a day). A trade page that is already open keeps running the old version, so reload it (F5). You do not need to close the browser.
If "Detail data ★ New data available" appears at the bottom right after reloading, click it to rebuild the detail data.


■ Red number on the Tampermonkey icon

It is not an update notice. It is the number of Tampermonkey add-ons running on that page. On the trade page Mouseover Detail Viewer runs, so "1" is shown. To hide the number:
1. Click the Tampermonkey icon -> "Dashboard", then open the "Settings" tab.
2. Set "Config mode" at the top to "Advanced".
3. Set "Icon badge info" to "Disabled", then click "Save" below it.


■ Data

No game data is included. When you click the button, your browser downloads public data on GitHub. Nothing about you is sent anywhere, and Mouseover Detail Viewer never searches, buys or sells on the trade site.

・RePoE: https://github.com/repoe-fork
・grindinggear/skilltree-export: https://github.com/grindinggear/skilltree-export

This project is not affiliated with Grinding Gear Games.


License: MIT
