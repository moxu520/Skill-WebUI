#!/usr/bin/env node
"use strict";

const fs = require("fs/promises");
const path = require("path");

/**
 * @typedef {Object} Cue
 * @property {number} index
 * @property {string} timestamp
 * @property {string[]} lines
 */

/**
 * Print usage information.
 * @returns {void}
 */
function printHelp() {
  console.log(`Usage:
  node translate-srt.js --input <input.srt> --output <output.srt> [options]

Options:
  --input <path>              Input .srt file path.
  --output <path>             Output .srt file path.
  --target-language <code>    Target language label. Default: zh-CN
  --model <name>              Override OPENAI_MODEL.
  --base-url <url>            Override OPENAI_BASE_URL.
  --api-key <key>             Override OPENAI_API_KEY.
  --chunk-size <number>       Cue count per request. Default: 40
  --bilingual                 Keep original lines and append translation.
  --help                      Show this message.
`);
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv Raw argv values.
 * @returns {{
 *   input: string,
 *   output: string,
 *   targetLanguage: string,
 *   model: string,
 *   baseUrl: string,
 *   apiKey: string,
 *   chunkSize: number,
 *   bilingual: boolean
 * }}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--bilingual" || token === "--help") {
      args[token.slice(2)] = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }

    args[token.slice(2)] = value;
    i += 1;
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const input = String(args.input || "");
  const output = String(args.output || "");

  if (!input || !output) {
    throw new Error("Both --input and --output are required.");
  }

  const chunkSize = Number(args["chunk-size"] || 40);
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("--chunk-size must be a positive integer.");
  }

  return {
    input,
    output,
    targetLanguage: String(args["target-language"] || "zh-CN"),
    model: String(args.model || process.env.OPENAI_MODEL || "gpt-4.1-mini"),
    baseUrl: normalizeBaseUrl(String(args["base-url"] || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1")),
    apiKey: String(args["api-key"] || process.env.OPENAI_API_KEY || ""),
    chunkSize,
    bilingual: Boolean(args.bilingual),
  };
}

/**
 * Normalize the base URL by removing trailing slashes.
 * @param {string} url Base URL.
 * @returns {string}
 */
function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

/**
 * Ensure the API key is present.
 * @param {string} apiKey Provider API key.
 * @returns {void}
 */
function validateApiKey(apiKey) {
  if (!apiKey) {
    throw new Error("Missing API key. Set OPENAI_API_KEY or pass --api-key.");
  }
}

/**
 * Parse an SRT document into cues.
 * @param {string} content Raw SRT text.
 * @returns {Cue[]}
 */
function parseSrt(content) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.split("\n"))
    .map((lines) => {
      if (lines.length < 2) {
        throw new Error(`Invalid cue block: ${lines.join(" | ")}`);
      }

      const index = Number(lines[0].trim());
      if (!Number.isInteger(index)) {
        throw new Error(`Invalid cue index: ${lines[0]}`);
      }

      return {
        index,
        timestamp: lines[1].trim(),
        lines: lines.slice(2).map((line) => line.trimEnd()),
      };
    });
}

/**
 * Serialize cues back to SRT text.
 * @param {Cue[]} cues Subtitle cues.
 * @returns {string}
 */
function serializeSrt(cues) {
  return `${cues
    .map((cue) => [String(cue.index), cue.timestamp, ...cue.lines].join("\n"))
    .join("\n\n")}\n`;
}

/**
 * Split cues into chunks.
 * @param {Cue[]} cues Subtitle cues.
 * @param {number} chunkSize Cues per chunk.
 * @returns {Cue[][]}
 */
function chunkCues(cues, chunkSize) {
  /** @type {Cue[][]} */
  const chunks = [];

  for (let index = 0; index < cues.length; index += chunkSize) {
    chunks.push(cues.slice(index, index + chunkSize));
  }

  return chunks;
}

/**
 * Build the translation prompt payload.
 * @param {Cue[]} cues Subtitle cues.
 * @param {string} targetLanguage Target language label.
 * @returns {string}
 */
function buildUserPrompt(cues, targetLanguage) {
  const payload = cues.map((cue) => ({
    index: cue.index,
    text: cue.lines.join("\n"),
  }));

  return [
    `Translate each subtitle text into ${targetLanguage}.`,
    "Keep speaker labels, punctuation, and line breaks natural.",
    "Return JSON only in the form:",
    '{"items":[{"index":1,"translated":"..."}]}',
    "Do not omit any item. Do not change indexes.",
    JSON.stringify({ items: payload }),
  ].join("\n");
}

/**
 * Call the provider Chat Completions API.
 * @param {{
 *   apiKey: string,
 *   baseUrl: string,
 *   model: string
 * }} config Provider config.
 * @param {string} userPrompt Translation payload.
 * @returns {Promise<string>}
 */
async function requestTranslation(config, userPrompt) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a subtitle translator. Translate text accurately and naturally. Return strict JSON only.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Translation request failed with HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider response did not include message content.");
  }

  return content;
}

/**
 * Parse translated items from the provider response.
 * @param {string} rawContent Raw JSON text.
 * @returns {Map<number, string>}
 */
function parseTranslationResponse(rawContent) {
  const parsed = JSON.parse(rawContent);
  const items = parsed?.items;
  if (!Array.isArray(items)) {
    throw new Error("Translation response JSON must include an items array.");
  }

  /** @type {Map<number, string>} */
  const translations = new Map();

  for (const item of items) {
    const index = Number(item?.index);
    const translated = typeof item?.translated === "string" ? item.translated.trim() : "";
    if (!Number.isInteger(index) || !translated) {
      throw new Error("Each translation item must include integer index and non-empty translated text.");
    }

    translations.set(index, translated);
  }

  return translations;
}

/**
 * Apply translations to a cue list.
 * @param {Cue[]} cues Subtitle cues.
 * @param {Map<number, string>} translations Translated text by cue index.
 * @param {boolean} bilingual Whether to keep original lines.
 * @returns {Cue[]}
 */
function applyTranslations(cues, translations, bilingual) {
  return cues.map((cue) => {
    const translated = translations.get(cue.index);
    if (!translated) {
      throw new Error(`Missing translation for cue ${cue.index}.`);
    }

    return {
      ...cue,
      lines: bilingual ? [...cue.lines, translated] : translated.split("\n"),
    };
  });
}

/**
 * Translate cues in batches.
 * @param {Cue[]} cues Subtitle cues.
 * @param {{
 *   apiKey: string,
 *   baseUrl: string,
 *   model: string,
 *   targetLanguage: string,
 *   chunkSize: number,
 *   bilingual: boolean
 * }} options Translation options.
 * @returns {Promise<Cue[]>}
 */
async function translateCues(cues, options) {
  /** @type {Cue[]} */
  const translatedCues = [];
  const chunks = chunkCues(cues, options.chunkSize);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    console.log(`Translating chunk ${index + 1}/${chunks.length} (${chunk.length} cues)...`);
    const userPrompt = buildUserPrompt(chunk, options.targetLanguage);
    const rawContent = await requestTranslation(options, userPrompt);
    const translations = parseTranslationResponse(rawContent);
    translatedCues.push(...applyTranslations(chunk, translations, options.bilingual));
  }

  return translatedCues;
}

/**
 * Ensure the input file extension is supported.
 * @param {string} filePath Input path.
 * @returns {void}
 */
function validateInputFile(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".srt") {
    throw new Error("Only .srt input is supported by this script.");
  }
}

/**
 * Ensure cue counts and timestamps are preserved.
 * @param {Cue[]} original Original cues.
 * @param {Cue[]} translated Translated cues.
 * @returns {void}
 */
function validateOutputStructure(original, translated) {
  if (original.length !== translated.length) {
    throw new Error("Cue count changed after translation.");
  }

  for (let index = 0; index < original.length; index += 1) {
    if (original[index].index !== translated[index].index) {
      throw new Error(`Cue index changed at position ${index + 1}.`);
    }

    if (original[index].timestamp !== translated[index].timestamp) {
      throw new Error(`Timestamp changed for cue ${original[index].index}.`);
    }
  }
}

/**
 * Run the CLI.
 * @returns {Promise<void>}
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  validateApiKey(options.apiKey);
  validateInputFile(options.input);

  const source = await fs.readFile(options.input, "utf8");
  const cues = parseSrt(source);
  if (cues.length === 0) {
    throw new Error("Input subtitle file is empty.");
  }

  const translatedCues = await translateCues(cues, options);
  validateOutputStructure(cues, translatedCues);
  await fs.writeFile(options.output, serializeSrt(translatedCues), "utf8");
  console.log(`Wrote translated subtitle to ${options.output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
