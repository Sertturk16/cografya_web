import { FormErrorSummary } from "cografya_web";
import * as React from "react";

export const TwoErrors = () => {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  return (
    <div className="max-w-sm">
      <FormErrorSummary
        headingRef={headingRef}
        summary="Formda 2 hata var"
        fieldErrors={[
          { id: "ds-email", label: "E-posta" },
          { id: "ds-altitude", label: "Rakım" },
        ]}
      />
    </div>
  );
};
