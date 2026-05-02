import { NextResponse } from "next/server";
import {
  getSkill,
  saveTranslatedSkill,
} from "@/lib/skills/skill-repository";
import {
  buildTranslationMeta,
  translateSkillContent,
} from "@/lib/translation/service";
import type {
  SaveTranslatedSkillRequest,
  TranslateSkillInput,
} from "@/lib/types";

/** 执行单个受管技能的翻译预览，不直接落盘。 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as TranslateSkillInput;
    const { id } = await context.params;
    const skill = await getSkill(id);
    const translated = await translateSkillContent(skill, body);

    return NextResponse.json({
      translatedSkill: {
        name: translated.name,
        description: translated.description,
        bodyMarkdown: translated.bodyMarkdown,
      },
      translationMeta: translated.meta,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "翻译技能失败。" },
      { status: 400 },
    );
  }
}

/** 保存翻译后的技能内容，并按选定策略写回工作区。 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = (await request.json()) as SaveTranslatedSkillRequest;
    const { id } = await context.params;
    const translationMeta = buildTranslationMeta({
      provider: body.provider,
      direction: body.direction,
      saveMode: body.saveMode,
    });
    const result = await saveTranslatedSkill({
      sourceId: id,
      name: body.name,
      description: body.description,
      bodyMarkdown: body.bodyMarkdown,
      saveMode: body.saveMode,
      slugSuffix: translationMeta.targetLanguage === "en" ? "en" : "zh",
      titleSuffix: translationMeta.targetLanguage === "en" ? "（英文）" : "（中文）",
      meta: translationMeta,
    });

    return NextResponse.json(result, {
      status: body.saveMode === "fork" ? 201 : 200,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存翻译结果失败。" },
      { status: 400 },
    );
  }
}
