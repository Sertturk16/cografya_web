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
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { StatTile } from "@/components/patterns/stat-tile";
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
          <Progress value={64}>
            <ProgressLabel>Tur ilerlemesi</ProgressLabel>
            <ProgressValue />
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <Progress value={null}>
            <ProgressLabel>Veri çekiliyor</ProgressLabel>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
      </Specimen>

      <Specimen
        name="Pagination"
        description="Gerçek <a> elemanları: bir sayfa bağlantısı bir konumdur, orta tık ve yeni sekmede aç çalışmalı. Aktif sayfa aria-current='page' taşır, yalnızca renkle değil."
      >
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">9</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
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
        description="48 V2 dosyasının elle yazdığı desen. Etiket DOM'da önce gelir — ekran okuyucuya '18,2 °C' deyip neyi ölçtüğünü söylememek hiçbir şey söylememektir; görsel hiyerarşiyi punto taşır, kaynak sırası değil."
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
