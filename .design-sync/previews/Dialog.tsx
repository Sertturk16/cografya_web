import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "cografya_web";

export const Confirm = () => (
  <Dialog defaultOpen>
    <DialogTrigger render={<Button variant="outline">Turu sıfırla</Button>} />
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Turu sıfırla</DialogTitle>
        <DialogDescription>
          Bu turdaki tüm cevapların silinecek. Bu işlem geri alınamaz.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost">Vazgeç</Button>} />
        <DialogClose render={<Button variant="destructive">Sıfırla</Button>} />
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
