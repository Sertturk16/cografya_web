import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "cografya_web";

export const Faq = () => (
  <Accordion className="max-w-md" defaultValue={["a"]}>
    <AccordionItem value="a">
      <AccordionTrigger>Bölge nedir?</AccordionTrigger>
      <AccordionContent>
        Türkiye yedi coğrafi bölgeye ayrılır; bu ayrım idari değil, coğrafidir.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="b">
      <AccordionTrigger>Magnitüd ile şiddet aynı mı?</AccordionTrigger>
      <AccordionContent>
        Hayır. Magnitüd olayın enerjisini, şiddet ise belirli bir noktadaki etkisini anlatır.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="c">
      <AccordionTrigger>Veriler nereden geliyor?</AccordionTrigger>
      <AccordionContent>Nüfus TÜİK'ten, depremler AFAD'dan, iklim ERA5-Land'den.</AccordionContent>
    </AccordionItem>
  </Accordion>
);
