// kana64n.ts — 数字＋カタカナによる64進数表記（kana64n：数字入り版）
//
// ・表示用アルファベット: 0-9 + 清音46文字 + 濁音8文字（コードポイント順に整列）
// ・内部用ASCIIアルファベット: 0-9 A-Z _ a-z ~（URLセーフ・ASCII順も単調増加）
// 変換ロジックは kana64-core.ts。ここではkana64nの設定だけを持つ。

import { pathToFileURL } from "node:url";
import { createCodec, selfTest, ASCII_ALPHABET, group } from "./kana64-core.ts";

const codec = createCodec({
  charset:
    "0123456789" +
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
    "ガギグゲゴザジズ",
  // 長音「ー」は意図的に未対応（置換せずエラーにする）
  confusables: { "口": "ロ", "二": "ニ", "工": "エ", "力": "カ", "卜": "ト", "八": "ハ", "〇": "0" },
});

export const KANA_ALPHABET = codec.alphabet;
export { ASCII_ALPHABET, group };
export const { normalize, toKana, fromKana, toAscii, fromAscii, kanaToAscii, asciiToKana } = codec;

// ---- 動作確認（node --experimental-strip-types kana64n.ts） ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  selfTest(codec, (log) => {
    log("ひらがな入力   :", fromKana("あいう"), "=", fromKana("アイウ"));
    log("半角カナ入力   :", fromKana("ｶﾞｷﾞ"), "=", fromKana("ガギ"));
    log("漢字の誤入力   :", fromKana("口二工"), "=", fromKana("ロニエ"));
    log("区切り付き入力 :", fromKana("アイウエ・オカ"), "=", fromKana("アイウエオカ"));
  });
}
