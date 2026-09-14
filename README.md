# ripple-portal

放課後等デイサービス りぷるのスタッフ研修ポータル。

公開ページ: https://overvivi.github.io/ripple-portal/ripple.html

`ripple.html` と `assets/mascot/` を一緒に配信します。
TOPのリプルはタップ・ドラッグ・2本指の操作に反応し、ときどき瞬きします。操作説明は画面に表示しません。
ヘルプや講義の戻る案内には静止ポーズを使用します。
TOP下部には、イノベーション・りぷる・といろが並ぶ静止画像を配置しています。

キャラクターの共通処理は `assets/mascot/mascot-v1.js`、表示は `mascot-v1.css`、画像は透過WebPです。動きを減らす設定に対応し、WebGL非対応時は画像のCSS変形に切り替わります。
