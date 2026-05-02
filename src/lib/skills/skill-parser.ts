/** 解析后的技能 Markdown 结构。 */
export type ParsedSkillMarkdown = {
  title: string;
  description: string;
  bodyMarkdown: string;
};

/** YAML frontmatter 中当前需要读取的基础字段。 */
type SkillFrontmatter = {
  name?: string;
  description?: string;
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

/** 判断当前行是否为 YAML frontmatter 的开始或结束分隔符。 */
function isFrontmatterFence(line: string | undefined) {
  return line?.trim() === "---";
}

/** 解析单行 `key: value` 形式的 frontmatter 字段。 */
function parseFrontmatterField(line: string) {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const key = line.slice(0, separatorIndex).trim();
  const value = line
    .slice(separatorIndex + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (!key) {
    return null;
  }

  return { key, value };
}

/** 提取并移除文档顶部的 YAML frontmatter。 */
function extractFrontmatter(lines: string[]) {
  if (!isFrontmatterFence(lines[0])) {
    return { frontmatter: {} as SkillFrontmatter, contentLines: lines };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && isFrontmatterFence(line));

  if (closingIndex === -1) {
    return { frontmatter: {} as SkillFrontmatter, contentLines: lines };
  }

  const frontmatter: SkillFrontmatter = {};

  for (const line of lines.slice(1, closingIndex)) {
    const field = parseFrontmatterField(line);

    if (!field) {
      continue;
    }

    if (field.key === "name") {
      frontmatter.name = field.value;
    }

    if (field.key === "description") {
      frontmatter.description = field.value;
    }
  }

  return {
    frontmatter,
    contentLines: trimLeadingBlankLines(lines.slice(closingIndex + 1)),
  };
}

/**
 * 从 `SKILL.md` 原文中提取标题、描述和正文。
 * 标题优先读取一级标题，描述优先读取正文前的第一段。
 */
export function parseSkillMarkdown(
  rawMarkdown: string,
  fallbackTitle: string,
): ParsedSkillMarkdown {
  const originalLines = trimLeadingBlankLines(rawMarkdown.split(/\r?\n/));
  const { frontmatter, contentLines } = extractFrontmatter(originalLines);
  const lines = [...contentLines];
  let title = frontmatter.name?.trim() || fallbackTitle;
  let description = frontmatter.description?.trim() || "";

  if (lines[0]?.startsWith("# ")) {
    title = lines.shift()!.replace(/^#\s+/, "").trim() || fallbackTitle;
  }

  trimLeadingBlankLines(lines);

  if (!description && lines[0] && !lines[0].startsWith("#")) {
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
