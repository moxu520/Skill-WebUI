/** 解析后的技能 Markdown 结构。 */
export type ParsedSkillMarkdown = {
  title: string;
  description: string;
  bodyMarkdown: string;
};

/** 去掉文本开头连续的空行，保持解析入口稳定。 */
function trimLeadingBlankLines(lines: string[]) {
  while (lines[0]?.trim() === "") {
    lines.shift();
  }

  return lines;
}

/** 去掉文本末尾连续的空行，避免保存后正文尾部膨胀。 */
function trimTrailingBlankLines(lines: string[]) {
  while (lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  return lines;
}

/**
 * 从 `SKILL.md` 原文中提取标题、描述和正文。
 * 标题优先读取一级标题，描述优先读取正文前的第一段。
 */
export function parseSkillMarkdown(
  rawMarkdown: string,
  fallbackTitle: string,
): ParsedSkillMarkdown {
  const lines = trimLeadingBlankLines(rawMarkdown.split(/\r?\n/));
  let title = fallbackTitle;
  let description = "";

  if (lines[0]?.startsWith("# ")) {
    title = lines.shift()!.replace(/^#\s+/, "").trim() || fallbackTitle;
  }

  trimLeadingBlankLines(lines);

  if (lines[0] && !lines[0].startsWith("#")) {
    description = lines.shift()!.trim();
    trimLeadingBlankLines(lines);
  }

  trimTrailingBlankLines(lines);

  return {
    title,
    description,
    bodyMarkdown: lines.join("\n"),
  };
}

/** 将结构化技能内容重新拼装成标准的 `SKILL.md` 文本。 */
export function buildSkillMarkdown(input: {
  title: string;
  description: string;
  bodyMarkdown: string;
}) {
  const sections = [`# ${input.title.trim()}`];

  if (input.description.trim()) {
    sections.push(input.description.trim());
  }

  if (input.bodyMarkdown.trim()) {
    sections.push(input.bodyMarkdown.trim());
  }

  return `${sections.join("\n\n")}\n`;
}
