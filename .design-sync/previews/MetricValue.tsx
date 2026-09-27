import { MetricValue } from "cografya_web";

export const Readings = () => (
  <div className="flex flex-wrap items-end gap-8">
    <MetricValue value={18.2} unit="°C" precision={1} locale="tr" absent={{ label: "Okuma yok" }} />
    <MetricValue value={1214} unit="m" locale="tr" absent={{ label: "Okuma yok" }} />
    <MetricValue value={5864049} locale="tr" absent={{ label: "Okuma yok" }} />
  </div>
);

export const Absent = () => (
  <MetricValue
    value={null}
    unit="°C"
    absent={{ label: "Veri bağlı değil", hint: "Kaynak henüz açılmadı" }}
  />
);
