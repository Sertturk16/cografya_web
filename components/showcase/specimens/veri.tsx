import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
  TableSkeleton,
  TableSortButton,
} from "@/components/ui/table";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { StatTile } from "@/components/patterns/stat-tile";
import { StatGrid } from "@/components/patterns/stat-grid";
import { MetricValue } from "@/components/patterns/metric-value";
import { Specimen } from "../specimen";

export function VeriSpecimens() {
  return (
    <>
      <Specimen
        name="Table"
        description="Sayısal sütunlar sağa hizalanır — rakamlar basamak basamak karşılaştırılabilsin diye."
      >
        <Table>
          <TableCaption>Seçili illerin yıllık ortalama sıcaklığı (ERA5-Land).</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>İl</TableHead>
              <TableHead>Bölge</TableHead>
              <TableHead className="text-right">Ortalama °C</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Adana</TableCell>
              <TableCell>Akdeniz</TableCell>
              <TableCell className="text-right tabular-nums">18,2</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Erzurum</TableCell>
              <TableCell>Doğu Anadolu</TableCell>
              <TableCell className="text-right tabular-nums">5,1</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Rize</TableCell>
              <TableCell>Karadeniz</TableCell>
              <TableCell className="text-right tabular-nums">14,4</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Specimen>

      <Specimen name="Table — boş ve yükleniyor durumları">
        <div className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İl</TableHead>
                <TableHead className="text-right">Ortalama °C</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty
                colSpan={2}
                title="Kayıt bulunamadı"
                description="Bu filtreye uyan il yok. Filtreyi genişletmeyi deneyin."
              />
            </TableBody>
          </Table>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İl</TableHead>
                <TableHead className="text-right">Ortalama °C</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton colSpan={2} rowCount={3} />
            </TableBody>
          </Table>
        </div>
      </Specimen>

      <Specimen
        name="Progress"
        description="Belirli ilerleme role=progressbar ve aria-valuenow taşır. Belirsiz olan aria-valuenow'u ATLAR — 0 göndermek 'hiç ilerlemedi' demek olurdu, oysa kastedilen 'ne kadar ilerlediği bilinmiyor'."
      >
        <div className="max-w-sm space-y-6">
          {/* `Progress` appends its own ProgressTrack/ProgressIndicator after `children`, so
              passing them here too rendered TWO tracks per bar — visible in the showcase and
              nowhere else. Found while adopting the component at its first real call sites
              (T-036). Children are for the label and the value only. */}
          <Progress value={64}>
            <ProgressLabel>Tur ilerlemesi</ProgressLabel>
            <ProgressValue />
          </Progress>
          <Progress value={null}>
            <ProgressLabel>Veri çekiliyor</ProgressLabel>
          </Progress>
        </div>
      </Specimen>

      <Specimen
        name="MetricValue"
        description="absent prop'u ZORUNLU. T-024, veri yokken 'canlı saatlik telemetri' vaat eden bir sayfa sevk etmişti; düzeltme sayfa sayfa koşullu kopyaydı ve bir sonraki sayfa unutana kadar çalışır. Zorunlu kılmak garantiyi tip sistemine taşıyor: çağıran, veri yokken ne görüneceğine karar vermeyi atlayamıyor. Asla 0 basmaz, asla çıplak tire basmaz — tire sayının oturduğu yere oturur ve bakışta ölçüm gibi okunur."
      >
        <div className="flex flex-wrap items-end gap-8">
          <MetricValue value={18.2} unit="°C" precision={1} absent={{ label: "Okuma yok" }} />
          <MetricValue value={1214} unit="m" absent={{ label: "Okuma yok" }} />
          <MetricValue
            value={null}
            unit="°C"
            absent={{ label: "Veri bağlı değil", hint: "Kaynak henüz açılmadı" }}
          />
        </div>
      </Specimen>

      <Specimen
        name="StatTile"
        description="35 dosyanın elle yazdığı desen. Etiket DOM'da ÖNCE gelir — ekran okuyucuya '18,2 °C' deyip neyi ölçtüğünü söylememek hiçbir şey söylememektir. Ekranda ise değer üstte durur; sitenin on üç metrik şeridinin dili bu. İkisi ayrı ayarlanıyor: erişilebilir sıra kaynak sırası, görsel sıra order-* yardımcılarıyla."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Yıllık ortalama"
            value={18.2}
            unit="°C"
            precision={1}
            hint="ERA5-Land, 1991-2020"
            absent={{ label: "Okuma yok" }}
          />
          <StatTile label="Rakım" value={23} unit="m" absent={{ label: "Okuma yok" }} />
          <StatTile
            label="Deniz suyu sıcaklığı"
            value={undefined}
            unit="°C"
            absent={{ label: "Veri bağlı değil", hint: "MARINE_ENABLED kapalı" }}
          />
        </div>
      </Specimen>

      <Specimen
        name="StatTile — fact kanalı ve tone"
        description="Şeritlerin taşıdığı değerlerin çoğu sayı değil: 'WGS84', 'Haversine', 'M 1.0 - 7.0+'. Bunlar için fact kanalı var — MetricValue'ya hiç uğramaz, çünkü value'yu string'e açmak T-024'ün imkânsız kıldığı şeyi (bir tire ya da sıfırı ölçüm gibi basmayı) geri getirirdi. Renk kapalı bir tone birleşimiyle geliyor: beş şerit ham Tailwind palet sınıfları taşıyordu ve hiçbirinin karanlık modda karşılığı yoktu."
      >
        {/* `columns="2"`, not the strips' `2-4`: ThemePair renders two half-width panes, so a
            four-across grid gives each tile ~100px here and clips a `text-3xl` value. The real
            pages give the strip the full page width — measured down to 320px. */}
        <StatGrid columns="2" gap="tight">
          <StatTile label="Küresel Elipsoid Modeli" fact="WGS84" tone="primary" />
          <StatTile label="Büyük Daire Eğrilik Hesabı" fact="Haversine" tone="secondary" />
          <StatTile label="Morfogenetik Çeşitlilik" fact="6 Kıyı Tipi" tone="accent" />
          <StatTile label="Fiyort, Skyer &amp; Haliç" fact="3 Tip Yok" tone="destructive" />
        </StatGrid>
      </Specimen>

      <Specimen
        name="StatGrid"
        description="Yalnızca duyarlı ızgara kabuğu — sütunlar, boşluk ve üstteki ayrım. className yok: PageContainer ile aynı gerekçe, geçirgen bir prop dağınıklığı tekrar içeri alır ve sayaçlar kaynak yazımını okuduğu için bunu göremez."
      >
        {/* Short values, so the six-across spelling is legible even at pane width. */}
        <StatGrid columns="2-3-6" gap="tight">
          <StatTile label="İl" fact="81" tone="primary" />
          <StatTile label="Bölge" fact="7" tone="secondary" />
          <StatTile label="İlçe" fact="973" tone="accent" />
          <StatTile label="Deniz" fact="4" />
          <StatTile label="Kıyı ili" fact="28" tone="primary" />
          <StatTile label="Kıta" fact="7" tone="secondary" />
        </StatGrid>
      </Specimen>

      <Specimen
        name="Table — sıralama"
        description="Sıralama bir EYLEM, o yüzden gerçek bir button — klavyeyle ulaşılabilir ve basılabilir olarak duyurulur; tıklanabilir bir <th> ikisi de değildir. aria-sort ise <th>'de durur, butonda değil: sütunun durumunu tarif eder, buton onu yalnızca değiştirir. Sırasız durumun kendi ikonu var, yani sıralanabilen bir sütun sıralanamayandan tıklamadan ayırt edilir."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead sort="ascending">
                <TableSortButton direction="ascending">İl</TableSortButton>
              </TableHead>
              <TableHead sort="none">
                <TableSortButton direction="none">Bölge</TableSortButton>
              </TableHead>
              <TableHead sort="none" className="text-right">
                <TableSortButton direction="none">Ortalama °C</TableSortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Adana</TableCell>
              <TableCell>Akdeniz</TableCell>
              <TableCell className="text-right tabular-nums">18,2</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Erzurum</TableCell>
              <TableCell>Doğu Anadolu</TableCell>
              <TableCell className="text-right tabular-nums">5,1</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Specimen>
    </>
  );
}
