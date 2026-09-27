import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "cografya_web";

export const Open = () => (
  <TooltipProvider>
    <div className="flex items-center justify-center p-10">
      <Tooltip defaultOpen>
        <TooltipTrigger
          render={
            <Button variant="outline" size="sm">
              M 4.5
            </Button>
          }
        />
        <TooltipContent>Magnitüd 4,5 ve üzeri olaylar</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
);
