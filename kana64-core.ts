// kana64-core.ts — カナ64進の共通コア。版ごとの違い（文字集合・置換表・エラー文）は設定で差し替える。
//
// どの版でも、アルファベットはコードポイント順に整列する。
// 並びの位置＝値なので、同じ桁数なら文字列ソート＝数値ソートになる。

export const ASCII_ALPHABET: string[] = [
  ..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~",
];

export interface CodecConfig {
  /** 表示用の文字集合（順不同でよい。コードポイント順に整列される。64文字） */
  charset: string;
  /** 見間違い・打ち間違いの置換表（正規化で適用） */
  confusables: Record<string, string>;
  /** 使えない文字に対するエラーメッセージ（省略時は汎用文言） */
  explainInvalid?: (c: string) => string | undefined;
}

export function createCodec(config: CodecConfig) {
  const alphabet: string[] = [...config.charset].sort(
    (a, b) => a.codePointAt(0)! - b.codePointAt(0)!,
  );
  if (alphabet.length !== 64 || new Set(alphabet).size !== 64) {
    throw new Error("kana alphabet must have 64 unique chars");
  }
  if (ASCII_ALPHABET.length !== 64) throw new Error("ascii alphabet must be 64");

  const kanaIndex = new Map(alphabet.map((c, i) => [c, i]));
  const asciiIndex = new Map(ASCII_ALPHABET.map((c, i) => [c, i]));

  /** 入力の正規化：全角/半角統一(NFKC)・ひらがな→カタカナ・誤入力の置換・区切り文字除去 */
  function normalize(input: string): string {
    let s = input.normalize("NFKC"); // 半角カナ→全角、結合濁点→合成済み、全角数字→半角
    s = s.replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60), // ひらがな→カタカナ
    );
    s = [...s].map((c) => config.confusables[c] ?? c).join("");
    return s.replace(/[\s_\-・]/g, ""); // 区切り文字は無視
  }

  function encodeWith(alpha: string[], n: bigint, minLength: number): string {
    if (n < 0n) throw new RangeError("negative numbers are not supported");
    const out: string[] = [];
    do {
      out.push(alpha[Number(n & 63n)]);
      n >>= 6n;
    } while (n > 0n);
    while (out.length < minLength) out.push(alpha[0]);
    return out.reverse().join("");
  }

  function invalid(c: string, explain?: (c: string) => string | undefined): SyntaxError {
    return new SyntaxError(explain?.(c) ?? `invalid character: "${c}"`);
  }

  function decodeWith(
    index: Map<string, number>,
    s: string,
    explain?: (c: string) => string | undefined,
  ): bigint {
    if (s.length === 0) throw new SyntaxError("empty string");
    let n = 0n;
    for (const c of s) {
      const v = index.get(c);
      if (v === undefined) throw invalid(c, explain);
      n = (n << 6n) | BigInt(v);
    }
    return n;
  }

  const toKana = (n: bigint | number, minLength = 1) =>
    encodeWith(alphabet, BigInt(n), minLength);
  const fromKana = (s: string) =>
    decodeWith(kanaIndex, normalize(s), config.explainInvalid);
  const toAscii = (n: bigint | number, minLength = 1) =>
    encodeWith(ASCII_ALPHABET, BigInt(n), minLength);
  const fromAscii = (s: string) => decodeWith(asciiIndex, s);

  /** カナ表記 → ASCII表記（1文字ずつ置換するだけ） */
  function kanaToAscii(s: string): string {
    return [...normalize(s)]
      .map((c) => {
        const v = kanaIndex.get(c);
        if (v === undefined) throw invalid(c, config.explainInvalid);
        return ASCII_ALPHABET[v];
      })
      .join("");
  }
  /** ASCII表記 → カナ表記 */
  function asciiToKana(s: string): string {
    return [...s]
      .map((c) => {
        const v = asciiIndex.get(c);
        if (v === undefined) throw invalid(c);
        return alphabet[v];
      })
      .join("");
  }

  return {
    alphabet,
    normalize,
    toKana,
    fromKana,
    toAscii,
    fromAscii,
    kanaToAscii,
    asciiToKana,
  };
}

/** 表示用：n文字ごとに区切る（例: "アイウエ・オカキク"） */
export const group = (s: string, size = 4, sep = "・") =>
  ([...s].join("").match(new RegExp(`.{1,${size}}`, "gu")) ?? []).join(sep);

/** セルフテスト（各版のファイルから呼ぶ） */
export function selfTest(
  codec: ReturnType<typeof createCodec>,
  extra?: (log: (...a: unknown[]) => void) => void,
): void {
  const { alphabet, toKana, fromKana, toAscii, fromAscii, kanaToAscii, asciiToKana } = codec;
  console.log("alphabet:", alphabet.join(""));

  for (const n of [0n, 9n, 10n, 63n, 64n, 12345n, 2n ** 64n - 1n]) {
    const k = toKana(n);
    console.log(`${n} → ${k}  (ascii: ${toAscii(n)})  → ${fromKana(k)}`);
  }

  extra?.(console.log);

  const id = toKana(987654321n);
  console.log(`カナ ${group(id)} ⇔ ASCII ${kanaToAscii(id)} ⇔ ${asciiToKana(kanaToAscii(id))}`);

  // ソート順の検証（同じ桁数ならコードポイント順＝数値順）
  let ok = true;
  for (let i = 0n; i < 64n * 64n - 1n; i++) {
    const a = toKana(i, 2), b = toKana(i + 1n, 2);
    const a2 = toAscii(i, 2), b2 = toAscii(i + 1n, 2);
    if (!(a < b) || !(a2 < b2)) { ok = false; console.log("NG:", i, a, b); break; }
  }
  console.log("ソート順の検証:", ok ? "OK" : "NG");
  if (!ok) throw new Error("sort order check failed");

  // 往復テスト
  for (let t = 0; t < 10000; t++) {
    const n = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    if (fromKana(toKana(n)) !== n || fromAscii(kanaToAscii(toKana(n))) !== n) {
      throw new Error(`round-trip failed: ${n}`);
    }
  }
  console.log("往復テスト: OK (10000件)");
}
