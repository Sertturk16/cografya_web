import { Progress, ProgressLabel, ProgressValue } from "cografya_web";

export const States = () => (
  <div className="max-w-sm space-y-6">
    <Progress value={64}>
      <ProgressLabel>Tur ilerlemesi</ProgressLabel>
      <ProgressValue />
    </Progress>
    <Progress value={null}>
      <ProgressLabel>Veri çekiliyor</ProgressLabel>
    </Progress>
  </div>
);
