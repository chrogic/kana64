// kana64.ts — カタカナだけによる64進数表記（kana64：基準の版）
//
// ・表示用アルファベット: 清音46文字 + 濁音18文字（ガ・ザ・ダ・バ行、ヂ・ヅを除く）
// ・半濁音（パ行）と小さいカナは使わない（入力時は理由つきのエラーにする）
// ・ヂ→ジ、ヅ→ズ は発音が同じなので入力時に許容する
// 変換ロジックは kana64-core.ts。ここではkana64の設定だけを持つ。

import { pathToFileURL } from "node:url";
import { createCodec, selfTest, ASCII_ALPHABET, group } from "./kana64-core.ts";

const PA = new Set([..."パピプペポ"]);
const SMALL = new Set([..."ァィゥェォッャュョヮヵヶ"]);

const codec = createCodec({
  charset:
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
    "ガギグゲゴザジズゼゾダデドバビブベボ",
  confusables: {
    "口": "ロ", "二": "ニ", "工": "エ", "力": "カ", "卜": "ト", "八": "ハ",
    "ヂ": "ジ", "ヅ": "ズ",
  },
  explainInvalid: (c) => {
    if (PA.has(c)) return `「${c}」は使えません。半濁音（パ行）は対象外です`;
    if (SMALL.has(c)) return `「${c}」は使えません。小さいカナは対象外です`;
    return `「${c}」は使えない文字です`;
  },
});

export const KANA_ALPHABET = codec.alphabet;
export { ASCII_ALPHABET, group };
export const { normalize, toKana, fromKana, toAscii, fromAscii, kanaToAscii, asciiToKana } = codec;

// ---- 動作確認（node --experimental-strip-types kana64.ts） ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  selfTest(codec, (log) => {
    log("ダイコン       :", toKana(6820735n), "=", fromKana("ダイコン"));
    log("ヂ・ヅの許容   :", fromKana("ヂヅ"), "=", fromKana("ジズ"));
    for (const bad of ["パ", "ッ"]) {
      try { fromKana(bad); } catch (e) { log("エラー例       :", (e as Error).message); }
    }
  });
}
