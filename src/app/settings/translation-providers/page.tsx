import { Badge } from "@/components/ui/badge";
import { translationProviderCatalog } from "@/lib/translation/catalog";

/** 翻译服务设置页，展示当前 provider 接入状态与后续扩展入口。 */
export default function SettingsTranslationProvidersPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">翻译服务目录</h2>
        <p className="mt-1 text-sm text-slate-500">
          首版先开放应用内置执行通道，并为后续外部翻译服务预留统一入口。
        </p>

        <div className="mt-5 grid gap-3">
          {translationProviderCatalog.map((provider) => (
            <div
              key={provider.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {provider.label}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {provider.description}
                  </p>
                </div>
                <Badge variant={provider.status === "available" ? "accent" : "muted"}>
                  {provider.kindLabel}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
