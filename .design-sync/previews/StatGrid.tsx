import { StatGrid, StatTile } from "cografya_web";

export const Strip = () => (
  <StatGrid>
    <StatTile label="İl" fact="81" tone="primary" />
    <StatTile label="Bölge" fact="7" tone="secondary" />
    <StatTile label="İlçe" fact="973" tone="accent" />
    <StatTile label="Deniz" fact="4" />
  </StatGrid>
);

export const TwoColumns = () => (
  <StatGrid columns="2">
    <StatTile label="Küresel Elipsoid Modeli" fact="WGS84" tone="primary" />
    <StatTile label="Büyük Daire Hesabı" fact="Haversine" tone="secondary" />
  </StatGrid>
);
