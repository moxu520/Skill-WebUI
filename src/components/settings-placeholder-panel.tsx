/** 设置占位面板参数。 */
type SettingsPlaceholderPanelProps = {
  title: string;
  description: string;
  hint: string;
};

/** 用于尚未接入真实配置的设置占位内容。 */
export function SettingsPlaceholderPanel({
  title,
  description,
  hint,
}: SettingsPlaceholderPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        {hint}
      </div>
    </section>
  );
}
