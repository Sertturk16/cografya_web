import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from "cografya_web";

export const Data = () => (
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
);

export const Empty = () => (
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
        description="Bu filtreye uyan il yok. Filtreyi genişletmeyi dene."
      />
    </TableBody>
  </Table>
);

export const Loading = () => (
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
);
