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
    </>
  );
}
